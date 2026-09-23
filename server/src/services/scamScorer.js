const TEXT_SIGNALS = [
  { pattern: /\b(send|share|give|provide|enter|ibigay|ipadala|isend)\b.{0,50}\b(otp|one[- ]?time password|pin)\b|\b(otp|one[- ]?time password|pin)\b.{0,40}\b(send|share|give|provide|enter|ibigay|ipadala)\b/i, points: 32, flag: 'Request to disclose an OTP or PIN' },
  { pattern: /\b(send|transfer|bayad|magbayad|cash in|cashout|deposit)\b.{0,55}\b(money|pera|gcash|maya|bank|account|fee)\b|\b(gcash|maya)\b.{0,55}\b(send|transfer|bayad|magbayad)\b/i, points: 23, flag: 'Money transfer or payment request' },
  { pattern: /\b(act now|immediately|urgent|urgently|today only|last chance|verify now|asap|ngayon na|agad|mawawala|ma-disable|blocked|suspended)\b/i, points: 13, flag: 'Urgency or account-pressure language' },
  { pattern: /\b(congratulations|congrats|nanalo|winner|won|prize|premyo|claim your reward)\b|₱\s?\d[\d,]*/i, points: 18, flag: 'Prize or reward claim' },
  { pattern: /\b(bank|gcash|maya|bdo|bpi|paymaya|facebook|lazada|shopee)\b.{0,50}\b(verify|suspended|blocked|security|support|account)\b/i, points: 15, flag: 'Possible brand impersonation' },
  { pattern: /\b(police|legal action|account will be deleted|ma-block|ma-deactivate|arrested)\b/i, points: 12, flag: 'Fear-based social engineering' },
  { pattern: /\b(click|i-click|pindutin|claim|verify|reply)\b.{0,45}\b(link|here|dito|now|ngayon)\b/i, points: 9, flag: 'Action requested through the message' },
];

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd']);
const BRAND_DOMAINS = new Map([
  ['gcash', ['gcash.com']], ['maya', ['maya.ph']], ['bpi', ['bpi.com.ph']],
  ['bdo', ['bdo.com.ph']], ['facebook', ['facebook.com']],
]);

export function detectLanguage(message) {
  const text = message.toLowerCase();
  const tagalog = (text.match(/\b(ang|ng|mga|ikaw|iyong|para|sa|hindi|nanalo|i-click|agad|ngayon|pera|ma-block|lods)\b/g) || []).length;
  const english = (text.match(/\b(the|your|account|verify|claim|please|now|click|will|you|and)\b/g) || []).length;
  return tagalog && english ? 'Taglish' : tagalog ? 'Tagalog' : 'English';
}

function extractUrls(message) {
  return (message.match(/(?:https?:\/\/|www\.|\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|is\.gd)\/)[^\s<>"']+/gi) || [])
    .map((candidate) => {
      try { return new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate.replace(/[.,!?]+$/, '')}`); }
      catch { return null; }
    }).filter(Boolean);
}

export function scoreScamMessage(message) {
  const input = String(message || '');
  const flags = [];
  const signals = [];
  let score = 0;
  const add = (flag, points) => { if (!flags.includes(flag)) { flags.push(flag); signals.push({ label: flag, points }); score += points; } };

  const otpContext = input.replace(/\b(?:do not|don't|never|huwag|wag)\s+(?:send|share|give|provide)\b.{0,35}\b(?:otp|pin)\b/gi, '');
  for (const signal of TEXT_SIGNALS) if (signal.pattern.test(signal.flag === 'Request to disclose an OTP or PIN' ? otpContext : input)) add(signal.flag, signal.points);

  for (const url of extractUrls(input)) {
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const full = `${host}${url.pathname}`.toLowerCase();
    if (SHORTENERS.has(host)) add('Shortened link hides the destination', 24);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('xn--')) add('Unusual link destination', 25);
    if (/(?:gcas(?!h)|gcash|may[a4]|bpi|bdo|faceb(?:oo|00)k)/i.test(host)) {
      const found = [...BRAND_DOMAINS].find(([brand]) => host.includes(brand));
      const known = found?.[1].some((domain) => host === domain || host.endsWith(`.${domain}`));
      if (!known) add('Unverified brand-like domain', 32);
    }
    if (/(?:verify|claim|reward|prize|reset|secure)[-_]?/.test(full)) add('Link asks for verification or reward claim', 20);
    if (/\/(?:login|signin|account|password)(?:\/|$|[?#])/.test(url.pathname + url.search)) add('Link leads to an account sign-in page', 16);
    if (url.protocol === 'http:') add('Link is not encrypted', 8);
  }

  if (flags.includes('Request to disclose an OTP or PIN') && flags.includes('Prize or reward claim') && (flags.includes('Shortened link hides the destination') || flags.includes('Link asks for verification or reward claim'))) add('OTP, prize and link appear together', 15);
  if ((input.match(/!/g) || []).length >= 3) add('Excessive urgency punctuation', 4);
  if ((input.match(/\b[A-Z]{4,}\b/g) || []).length >= 2) add('Pressure-style capitalization', 4);

  score = Math.min(score, 100);
  const level = score >= 80 ? 'Scam' : score >= 60 ? 'High' : score >= 30 ? 'Warning' : 'Safe';
  const recommendation = score >= 60
    ? 'Do not open the link, send money, or share a code. Check the organization through its official app or known contact number.'
    : score >= 30
      ? 'Pause before responding. Verify the sender and the link through an independent official channel.'
      : 'No strong scam signals were found. Still verify unexpected requests before sharing information.';
  const explanation = flags.length
    ? `${flags.length} observable signal${flags.length === 1 ? '' : 's'} contributed to this educational risk estimate. It is not proof of fraud.`
    : 'No strong rule-based scam signals were detected. A low score does not guarantee safety.';
  return { score, level, flags, signals, language: detectLanguage(input), recommendation, explanation };
}
