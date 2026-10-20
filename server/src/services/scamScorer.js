const ANALYSIS_VERSION = '2.3.0';

const TEXT_SIGNALS = [
  { category: 'credentials', pattern: /\b(send|share|give|provide|enter|submit|ask|request|need|ibigay|ipadala|isend|i-send|hingi|hingin|humingi|manghingi|makahingi|pahingi|kailangan)\b.{0,60}\b(otp|one[- ]?time password|pin|password|cvv|verification code)\b|\b(otp|one[- ]?time password|pin|password|cvv|verification code)\b.{0,45}\b(send|share|give|provide|enter|submit|ask|request|ibigay|ipadala|isend|i-send|hingi|hingin|humingi|manghingi|makahingi|pahingi)\b/i, points: 34, flag: 'Requests a password, OTP, PIN, or verification code' },
  { category: 'payment', pattern: /\b(send|transfer|pay|payment|bayad|bayaran(?:g)?|magbayad|cash[ -]?in|cash[ -]?out|deposit|remit)\b.{0,65}\b(money|pera|gcash|maya|bank|account|fee|bayad|payment|crypto|usdt|puhunan|bonus|win|panalo)\b|\b(gcash|maya|bank|crypto|usdt|puhunan|bonus|win|panalo)\b.{0,65}\b(send|transfer|pay|bayad|bayaran|magbayad|deposit|cash[ -]?in)\b|\b(first|initial|advance|processing|delivery)\s+(payment|pay|fee)\b/i, points: 23, flag: 'Requests a money transfer or payment' },
  { category: 'urgency', pattern: /\b(act now|immediately|urgent|urgently|today only|last chance|verify now|within \d+ (?:minutes?|hours?)|asap|ngayon na|agad|mawawala|ma-disable|blocked|suspended|limited time)\b/i, points: 13, flag: 'Uses urgency or account-pressure language' },
  { category: 'reward', pattern: /\b(congratulations|congrats|nanalo|panalo|manalo|winner|won|prize|premyo|gantimpala|jackpot|cashback|cash reward|free gift|free spins?|signup bonus|sign[- ]?up bonus|claim your reward|claim (?:your )?(?:cash|bonus|gift|prize|reward)|(?:gift|bonus|extra)\b.{0,30}\b(?:kunin|claim|sign[ -]?in|register))\b/i, points: 24, flag: 'Promises a prize, reward, or unexpected money' },
  { category: 'financial_notice', pattern: /\b(?:received|credited|released|payout|transfer confirmed|successfully transferred|balance(?:\s+(?:is|now))?|added to your balance)\b.{0,45}\b(?:php|p|₱)\s?[\d,]+(?:\.\d{1,2})?\b|\b(?:php|p|₱)\s?[\d,]+(?:\.\d{1,2})?\b.{0,45}\b(?:received|credited|released|payout|transferred|balance)\b/i, points: 24, flag: 'Claims an unexpected transfer, balance, payout, or account credit' },
  { category: 'fake_notice', pattern: /\b(?:transaction alert|unusual transaction|traffic violation|settlement required|overdue account|mandatory additional charges?|cancel (?:this|here)|did not authorize)\b/i, points: 22, flag: 'Uses an unsolicited transaction, violation, or settlement alert' },
  { category: 'gambling', pattern: /\b(sure win|guaranteed win|win rate|jackpot|free spins?|scatter|paldo|panalo|manalo|daily rebate|deposit bonus|prediction market|try your luck)\b/i, points: 24, flag: 'Uses gambling or guaranteed-win promotion language' },
  { category: 'points', pattern: /\b(points?|rewards?|voucher)\b.{0,55}\b(expir(?:e|es|ing)|redeem|claim|convert|unused|unclaimed)\b|\b(expir(?:e|es|ing)|redeem|claim|convert|unused|unclaimed)\b.{0,55}\b(points?|rewards?|voucher)\b/i, points: 24, flag: 'Claims points, rewards, or vouchers require redemption' },
  { category: 'promotion', pattern: /\b(?:text|reply|send)\s+[a-z0-9]{1,12}\s+(?:to\s+)?\d{4,6}\b|\b(?:ringtone|mobile video player|mobile music service|polyphonic|gprs charges|wap to)\b/i, points: 22, flag: 'Shows signs of an unsolicited mobile-content promotion' },
  { category: 'promotion', pattern: /\b(?:customer service announcement|tickets? (?:are )?now on sale|selling fast|unsubscribe|reply (?:with )?(?:the word )?(?:out|stop)|text yes for a call|free mins\/texts|mobile phone by being an agent)\b/i, points: 20, flag: 'Uses unsolicited promotional or subscription wording' },
  { category: 'advance_fee', pattern: /\b(?:puhunan|hatian|balatuhan|saken|sa akin|akin ang|cash[ -]?out|cash[ -]?in)\b.{0,90}\b(?:panalo|manalo|paldo|win|facebook|fb|message|msg|chat)\b|\b(?:facebook|fb|message|msg|chat)\b.{0,90}\b(?:puhunan|hatian|balatuhan|saken|akin ang|paldo|win)\b/i, points: 32, flag: 'Offers winnings in exchange for a deposit or share of proceeds' },
  { category: 'reward', pattern: /\b(?:register|sign[ -]?up|join)\b.{0,70}\b(?:bonus|gift|reward|cash|php|peso|p\s?\d|daily benefits?|referral)\b|\b(?:bonus|gift|reward|cash|php|peso|p\s?\d|daily benefits?|referral)\b.{0,70}\b(?:register|sign[ -]?up|join)\b/i, points: 24, flag: 'Promises signup gifts, bonuses, or unusually large promotional benefits' },
  { category: 'reward', pattern: /\b(?:register free|join now|sign up now|get free|account (?:has been )?credited|have been awarded)\b.{0,100}\b(?:bonus|gift|reward|cash|text messages?|camera|php|peso|p\s?\d|\d+\s?p)\b|\b(?:bonus|gift|reward|cash|php|peso|p\s?\d|\d+\s?p)\b.{0,100}\b(?:register free|join now|sign up now|activate|collect)\b/i, points: 24, flag: 'Promises a promotional credit, gift, or signup reward' },
  { category: 'impersonation', pattern: /\b(bank|gcash|maya|bdo|bpi|unionbank|metrobank|facebook|lazada|shopee|philpost|sss|bir|nbi)\b.{0,60}\b(verify|suspended|blocked|security|support|account|refund|delivery)\b/i, points: 16, flag: 'May be impersonating a trusted organization' },
  { category: 'threat', pattern: /\b(police|legal action|account will be deleted|ma-block|ma-deactivate|arrested|warrant|penalty|final warning)\b/i, points: 14, flag: 'Uses fear, threats, or consequences to pressure action' },
  { category: 'action', pattern: /\b(click|i-click|pindutin|claim|verify|reply|open|visit|call|text|kunin|kumuha|activate|activation|pag-activate|mag-register|register|sign[ -]?up)\b.{0,50}\b(link|here|dito|now|ngayon|attachment|form|collect|activate|number|bonus|gift|gantimpala|\d{4,})\b/i, points: 9, flag: 'Pushes the recipient to take an immediate action' },
  { category: 'access', pattern: /\b(anydesk|teamviewer|remote desktop|screen share|quick support)\b/i, points: 28, flag: 'Requests remote access to a device' },
  { category: 'investment', pattern: /\b(guaranteed profit|double your money|no risk|instant return|investment opportunity|crypto investment|trading mentor)\b/i, points: 28, flag: 'Promises unrealistic or guaranteed investment returns' },
  { category: 'job', pattern: /\b(task job|product boosting|merchant task|recharge task|like and earn|encoding job)\b|\bjob\b.{0,60}\b(pay|deposit|recharge|fee)\b/i, points: 24, flag: 'Shows signs of a task or advance-fee job scam' },
];

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd', 'tiny.one', 'rb.gy', 'shorturl.at']);
const TRUSTED_DOMAINS = new Set(['gcash.com', 'maya.ph', 'bpi.com.ph', 'bdo.com.ph', 'unionbankph.com', 'metrobank.com.ph', 'facebook.com', 'lazada.com.ph', 'shopee.ph', 'gov.ph', 'lbcexpress.com', 'jobstreet.com.ph', 'pldt.com.ph', 'pagibigfund.gov.ph', 'bir.gov.ph', 'cashify.onelink.me']);
const BRAND_DOMAINS = new Map([
  ['gcash', ['gcash.com']], ['maya', ['maya.ph']], ['bpi', ['bpi.com.ph']], ['bdo', ['bdo.com.ph']],
  ['unionbank', ['unionbankph.com']], ['metrobank', ['metrobank.com.ph']], ['facebook', ['facebook.com']],
  ['lazada', ['lazada.com.ph']], ['shopee', ['shopee.ph']], ['philpost', ['phlpost.gov.ph']],
]);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const isDomainOrSubdomain = (host, domain) => host === domain || host.endsWith(`.${domain}`);

export function classifyRisk(score) {
  if (score >= 80) return 'Scam';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Warning';
  if (score >= 20) return 'Low Risk';
  return 'Safe';
}

function recommendationFor(score, categories = new Set()) {
  if (score >= 60) return 'Do not open links, send money, install remote-access apps, or share passwords and codes. Verify through the organization’s official app, website, or published contact number.';
  if (score >= 40) return 'Pause before responding. Independently verify the sender, request, and destination domain through an official channel.';
  if (score >= 20 && categories.has('credentials')) return 'Monitor the conversation and do not share the OTP, PIN, password, or verification code—even if the sender appears familiar. Confirm the sender and request through a separate trusted channel, such as a known Messenger account or a phone number you already have, instead of using contact details supplied in the message.';
  if (score >= 20) return 'Some suspicious indicators were detected, but the evidence is not strong enough for a Warning classification. Monitor the conversation, verify the sender through an official channel, and do not share passwords, OTPs, or payment details.';
  return 'No strong warning signs were detected in the submitted content. This does not prove it is safe; independently verify unexpected requests.';
}

export function detectLanguage(message) {
  const text = message.toLowerCase();
  const tagalog = (text.match(/\b(ang|ng|mga|ikaw|iyo|iyong|para|sa|hindi|huwag|wag|nanalo|pindutin|agad|ngayon|pera|bayad|ma-block|kailangan)\b/g) || []).length;
  const english = (text.match(/\b(the|your|account|verify|claim|please|now|click|will|you|and|send|payment)\b/g) || []).length;
  return tagalog && english ? 'Taglish' : tagalog ? 'Tagalog' : 'English';
}

export function extractUrls(message) {
  return (String(message).match(/(?:https?:\/\/|www\.|\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|is\.gd|tiny\.one|rb\.gy|shorturl\.at)\/)[^\s<>"']+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|ph|pw|tv|cc|vip|uk|cfd|me)(?:\/[^\s<>"']*)?/gi) || [])
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
  if (!trusted && /(?:casino|lotto|lucky|bingo|piso|laro|game|win)/.test(host)) add('Domain name suggests gambling or prize activity', 22);
  if (!trusted && /\/(?:login|signin|account|password|wallet)(?:\/|$|[?#])/.test(url.pathname + url.search)) add('Unknown domain leads to a sign-in or account page', 12);
  if (url.protocol === 'http:') add('Connection is not encrypted with HTTPS', 6);
  if (!trusted && points === 0) add('Uses an unrecognized external domain', 8);

  return {
    host,
    points: clamp(points, 0, 60),
    verdict: points >= 35 ? 'Suspicious' : points > 0 ? 'Caution' : trusted ? 'Recognized domain' : 'No known structural warning',
    reasons,
  };
}

export function scoreScamMessage(message) {
  const input = String(message || '').trim();
  const normalizedInput = input
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/(?<=\p{L})[^\p{L}\p{N}\s](?=\p{L})/gu, '')
    .replace(/\s+/g, ' ');
  const flags = [];
  const signals = [];
  const categories = new Set();
  let score = 0;
  const add = (label, points, category = 'behavior', evidence = '') => {
    if (flags.includes(label)) return;
    flags.push(label); categories.add(category); signals.push({ label, points, category, evidence }); score += points;
  };

  const otpContext = normalizedInput.replace(/\b(?:do not|don't|never|huwag|wag)\s+(?:send|share|give|provide|ibigay|ipadala)\b.{0,45}\b(?:otp|pin|password|code)\b/gi, '');
  for (const signal of TEXT_SIGNALS) {
    const source = signal.category === 'credentials' ? otpContext : `${input}\n${normalizedInput}`;
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
  if (has('financial_notice') && has('url')) add('Unexpected financial notice is combined with a link', 18, 'combination');
  if (has('fake_notice') && has('url')) add('Unsolicited alert directs the recipient to an external destination', 16, 'combination');
  if (has('gambling') && (has('payment') || has('url'))) add('Gambling promotion is combined with payment or an external destination', 16, 'combination');
  if (has('points') && (has('action') || has('url'))) add('Points or voucher claim is combined with a link or action request', 14, 'combination');
  if (has('advance_fee') && (has('payment') || has('gambling') || has('reward'))) add('Advance-fee language is combined with promised winnings', 18, 'combination');
  if (has('threat') && has('credentials')) add('Threat language is used to obtain sensitive credentials', 12, 'combination');
  if (has('access') && has('payment')) add('Remote-access request appears with a financial request', 16, 'combination');
  if ((input.match(/!/g) || []).length >= 3) add('Uses excessive urgency punctuation', 4, 'style');
  if ((input.match(/\b[A-Z]{4,}\b/g) || []).length >= 2) add('Uses pressure-style capitalization', 4, 'style');

  score = clamp(score, 0, 100);
  const level = classifyRisk(score);
  const strongest = Math.max(0, ...signals.map((signal) => signal.points));
  const confidence = clamp(Math.round(30 + Math.min(signals.length * 6, 30) + Math.min(strongest, 25) + (urls.length ? 8 : 0) - (input.length < 25 ? 8 : 0)), 20, 95);
  const confidenceLevel = confidence >= 75 ? 'High' : confidence >= 50 ? 'Moderate' : 'Low';
  const recommendation = recommendationFor(score, categories);
  const explanation = flags.length
    ? `${flags.length} observable signal${flags.length === 1 ? '' : 's'} across ${categories.size} evidence categor${categories.size === 1 ? 'y' : 'ies'} produced this risk estimate. Confidence reflects evidence strength, not certainty of fraud.`
    : 'No strong contextual or URL-structure warning was detected. Confidence is limited because new or previously unknown scams may not match known patterns.';

  return { score, level, confidence, confidenceLevel, analysisVersion: ANALYSIS_VERSION, flags, signals, urls, language: detectLanguage(input), recommendation, explanation };
}

export function applyUrlReputation(result, reputation) {
  if (!reputation?.configured || !reputation.results?.length) return { ...result, externalChecks: { configured: Boolean(reputation?.configured), checked: 0, status: reputation?.configured ? 'No URL found' : 'Not configured' } };
  const flags = [...result.flags];
  const signals = [...result.signals];
  let score = result.score;
  let confirmedThreats = 0;
  const urls = result.urls.map((local) => {
    const external = reputation.results.find((item) => item.host === local.host);
    if (!external) return local;
    if (external.verdict === 'Malicious') {
      const label = `External security provider flagged ${local.host}`;
      if (!flags.includes(label)) { flags.push(label); signals.push({ label, points: 45, category: 'reputation', evidence: external.providers.filter((item) => item.verdict === 'Malicious').map((item) => item.provider).join(', ') }); score += 45; }
      confirmedThreats += 1;
    } else if (external.verdict === 'Suspicious') {
      const label = `External security provider marked ${local.host} suspicious`;
      if (!flags.includes(label)) { flags.push(label); signals.push({ label, points: 25, category: 'reputation', evidence: external.providers.filter((item) => item.verdict === 'Suspicious').map((item) => item.provider).join(', ') }); score += 25; }
    }
    return { ...local, reputationVerdict: external.verdict, providers: external.providers };
  });
  score = clamp(score, 0, 100);
  const level = classifyRisk(score);
  const confidence = clamp(result.confidence + (confirmedThreats ? 12 : 4), 20, 98);
  const confidenceLevel = confidence >= 75 ? 'High' : confidence >= 50 ? 'Moderate' : 'Low';
  const explanation = confirmedThreats
    ? `${result.explanation} ${confirmedThreats} submitted link${confirmedThreats === 1 ? ' was' : 's were'} also flagged by an external security provider.`
    : `${result.explanation} External reputation checks found no listed threat, but that does not prove a link is safe.`;
  return { ...result, score, level, confidence, confidenceLevel, flags, signals, urls, explanation, recommendation: recommendationFor(score, new Set(signals.map((signal) => signal.category))), externalChecks: { configured: true, checked: reputation.checked, status: confirmedThreats ? 'Threat match found' : 'Completed' } };
}
