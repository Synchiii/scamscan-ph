const ANALYSIS_VERSION = '2.0.0';

const TEXT_SIGNALS = [
  { category: 'credentials', pattern: /\b(send|share|give|provide|enter|submit|ibigay|ipadala|isend|i-send)\b.{0,60}\b(otp|one[- ]?time password|pin|password|cvv|verification code)\b|\b(otp|one[- ]?time password|pin|password|cvv|verification code)\b.{0,45}\b(send|share|give|provide|enter|submit|ibigay|ipadala)\b/i, points: 34, flag: 'Requests a password, OTP, PIN, or verification code' },
  { category: 'payment', pattern: /\b(send|transfer|bayad|magbayad|cash[ -]?in|cash[ -]?out|deposit|remit)\b.{0,65}\b(money|pera|gcash|maya|bank|account|fee|crypto|usdt)\b|\b(gcash|maya|bank|crypto|usdt)\b.{0,65}\b(send|transfer|bayad|magbayad|deposit)\b/i, points: 23, flag: 'Requests a money transfer or payment' },
  { category: 'urgency', pattern: /\b(act now|immediately|urgent|urgently|today only|last chance|verify now|within \d+ (?:minutes?|hours?)|asap|ngayon na|agad|mawawala|ma-disable|blocked|suspended|limited time)\b/i, points: 13, flag: 'Uses urgency or account-pressure language' },
  { category: 'reward', pattern: /\b(congratulations|congrats|nanalo|winner|won|prize|premyo|claim your reward|cash reward|free gift)\b|₱\s?\d[\d,]*/i, points: 18, flag: 'Promises a prize, reward, or unexpected money' },
  { category: 'impersonation', pattern: /\b(bank|gcash|maya|bdo|bpi|unionbank|metrobank|facebook|lazada|shopee|philpost|sss|bir|nbi)\b.{0,60}\b(verify|suspended|blocked|security|support|account|refund|delivery)\b/i, points: 16, flag: 'May be impersonating a trusted organization' },
  { category: 'threat', pattern: /\b(police|legal action|account will be deleted|ma-block|ma-deactivate|arrested|warrant|penalty|final warning)\b/i, points: 14, flag: 'Uses fear, threats, or consequences to pressure action' },
  { category: 'action', pattern: /\b(click|i-click|pindutin|claim|verify|reply|open|visit)\b.{0,50}\b(link|here|dito|now|ngayon|attachment|form)\b/i, points: 9, flag: 'Pushes the recipient to take an immediate action' },
  { category: 'access', pattern: /\b(anydesk|teamviewer|remote desktop|screen share|quick support)\b/i, points: 28, flag: 'Requests remote access to a device' },
  { category: 'investment', pattern: /\b(guaranteed profit|double your money|no risk|instant return|investment opportunity|crypto investment|trading mentor)\b/i, points: 28, flag: 'Promises unrealistic or guaranteed investment returns' },
  { category: 'job', pattern: /\b(task job|product boosting|merchant task|recharge task|like and earn|encoding job)\b|\bjob\b.{0,60}\b(pay|deposit|recharge|fee)\b/i, points: 24, flag: 'Shows signs of a task or advance-fee job scam' },
];

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd', 'tiny.one', 'rb.gy', 'shorturl.at']);
const TRUSTED_DOMAINS = new Set(['gcash.com', 'maya.ph', 'bpi.com.ph', 'bdo.com.ph', 'unionbankph.com', 'metrobank.com.ph', 'facebook.com', 'lazada.com.ph', 'shopee.ph', 'gov.ph']);
const BRAND_DOMAINS = new Map([
  ['gcash', ['gcash.com']], ['maya', ['maya.ph']], ['bpi', ['bpi.com.ph']], ['bdo', ['bdo.com.ph']],
  ['unionbank', ['unionbankph.com']], ['metrobank', ['metrobank.com.ph']], ['facebook', ['facebook.com']],
  ['lazada', ['lazada.com.ph']], ['shopee', ['shopee.ph']], ['philpost', ['phlpost.gov.ph']],
]);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const isDomainOrSubdomain = (host, domain) => host === domain || host.endsWith(`.${domain}`);

export function detectLanguage(message) {
  const text = message.toLowerCase();
  const tagalog = (text.match(/\b(ang|ng|mga|ikaw|iyo|iyong|para|sa|hindi|huwag|wag|nanalo|pindutin|agad|ngayon|pera|bayad|ma-block|kailangan)\b/g) || []).length;
  const english = (text.match(/\b(the|your|account|verify|claim|please|now|click|will|you|and|send|payment)\b/g) || []).length;
  return tagalog && english ? 'Taglish' : tagalog ? 'Tagalog' : 'English';
}

export function extractUrls(message) {
  return (String(message).match(/(?:https?:\/\/|www\.|\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|is\.gd|tiny\.one|rb\.gy|shorturl\.at)\/)[^\s<>"']+/gi) || [])
    .map((candidate) => candidate.replace(/[\])},.!?;:]+$/, ''))
    .map((candidate) => {
      try { return new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`); }
      catch { return null; }
    }).filter(Boolean).slice(0, 10);
}

function inspectUrl(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const full = `${host}${url.pathname}${url.search}`.toLowerCase();
  const reasons = [];
  let points = 0;
  const add = (reason, value) => { if (!reasons.includes(reason)) { reasons.push(reason); points += value; } };
  const trusted = [...TRUSTED_DOMAINS].some((domain) => isDomainOrSubdomain(host, domain));

  if (SHORTENERS.has(host)) add('Shortened URL hides its final destination', 20);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) add('Uses an IP address instead of a normal domain', 27);
  if (host.startsWith('xn--') || host.split('.').some((part) => part.startsWith('xn--'))) add('Uses an internationalized domain that may imitate another name', 25);
  if (url.username || url.password) add('Contains misleading credentials before the domain', 25);
  if ((host.match(/-/g) || []).length >= 3 || host.length > 55) add('Domain structure is unusually complex', 8);
  if (url.port && !['80', '443'].includes(url.port)) add('Uses an unusual network port', 8);

  for (const [brand, officialDomains] of BRAND_DOMAINS) {
    const resemblesBrand = host.includes(brand) || (brand === 'gcash' && /gcas(?!h)|gca[s5]h/.test(host)) || (brand === 'facebook' && /faceb(?:oo|00)k/.test(host));
    if (resemblesBrand && !officialDomains.some((domain) => isDomainOrSubdomain(host, domain))) add('Domain resembles a brand but is not its recognized domain', 35);
  }
  if (!trusted && /(?:verify|claim|reward|prize|reset|secure|support|wallet|account)[-_]?/.test(full)) add('Unknown domain uses verification, account, or reward wording', 17);
  if (!trusted && /\/(?:login|signin|account|password|wallet)(?:\/|$|[?#])/.test(url.pathname + url.search)) add('Unknown domain leads to a sign-in or account page', 12);
  if (url.protocol === 'http:') add('Connection is not encrypted with HTTPS', 6);

  return {
    host,
    points: clamp(points, 0, 60),
    verdict: points >= 35 ? 'Suspicious' : points > 0 ? 'Caution' : trusted ? 'Recognized domain' : 'No known structural warning',
    reasons,
  };
}

export function scoreScamMessage(message) {
  const input = String(message || '').trim();
  const flags = [];
  const signals = [];
  const categories = new Set();
  let score = 0;
  const add = (label, points, category = 'behavior', evidence = '') => {
    if (flags.includes(label)) return;
    flags.push(label); categories.add(category); signals.push({ label, points, category, evidence }); score += points;
  };

  const otpContext = input.replace(/\b(?:do not|don't|never|huwag|wag)\s+(?:send|share|give|provide|ibigay|ipadala)\b.{0,45}\b(?:otp|pin|password|code)\b/gi, '');
  for (const signal of TEXT_SIGNALS) {
    const source = signal.category === 'credentials' ? otpContext : input;
    if (signal.pattern.test(source)) add(signal.flag, signal.points, signal.category, 'Detected from message context');
  }

  const urls = extractUrls(input).map(inspectUrl);
  for (const result of urls) {
    for (const reason of result.reasons) {
      const pointShare = Math.max(4, Math.round(result.points / result.reasons.length));
      add(`${reason} (${result.host})`, pointShare, 'url', result.host);
    }
  }

  const has = (category) => categories.has(category);
  if (has('credentials') && has('impersonation')) add('Credential request appears with organization impersonation', 18, 'combination');
  if (has('payment') && has('urgency')) add('Payment request is combined with time pressure', 12, 'combination');
  if (has('reward') && (has('action') || has('url'))) add('Reward claim is combined with a link or action request', 14, 'combination');
  if (has('threat') && has('credentials')) add('Threat language is used to obtain sensitive credentials', 12, 'combination');
  if (has('access') && has('payment')) add('Remote-access request appears with a financial request', 16, 'combination');
  if ((input.match(/!/g) || []).length >= 3) add('Uses excessive urgency punctuation', 4, 'style');
  if ((input.match(/\b[A-Z]{4,}\b/g) || []).length >= 2) add('Uses pressure-style capitalization', 4, 'style');

  score = clamp(score, 0, 100);
  const level = score >= 80 ? 'Scam' : score >= 55 ? 'High' : score >= 25 ? 'Warning' : 'Safe';
  const strongest = Math.max(0, ...signals.map((signal) => signal.points));
  const confidence = clamp(Math.round(30 + Math.min(signals.length * 6, 30) + Math.min(strongest, 25) + (urls.length ? 8 : 0) - (input.length < 25 ? 8 : 0)), 20, 95);
  const confidenceLevel = confidence >= 75 ? 'High' : confidence >= 50 ? 'Moderate' : 'Low';
  const recommendation = score >= 55
    ? 'Do not open links, send money, install remote-access apps, or share passwords and codes. Verify through the organization’s official app, website, or published contact number.'
    : score >= 25
      ? 'Pause before responding. Independently verify the sender, request, and destination domain through an official channel.'
      : 'No strong warning signs were detected in the submitted content. This does not prove it is safe; independently verify unexpected requests.';
  const explanation = flags.length
    ? `${flags.length} observable signal${flags.length === 1 ? '' : 's'} across ${categories.size} evidence categor${categories.size === 1 ? 'y' : 'ies'} produced this risk estimate. Confidence reflects evidence strength, not certainty of fraud.`
    : 'No strong contextual or URL-structure warning was detected. Confidence is limited because new or previously unknown scams may not match known patterns.';

  return { score, level, confidence, confidenceLevel, analysisVersion: ANALYSIS_VERSION, flags, signals, urls, language: detectLanguage(input), recommendation, explanation };
}
