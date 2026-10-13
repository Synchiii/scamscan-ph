const MAX_EXTERNAL_URLS = 3;
const REQUEST_TIMEOUT_MS = 4500;

function timeoutSignal() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchJson(url, options = {}) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { ...options, signal: timeout.signal });
    if (response.status === 404) return { status: 404, body: null };
    if (!response.ok) throw new Error(`Reputation provider returned ${response.status}`);
    return { status: response.status, body: await response.json() };
  } finally {
    timeout.clear();
  }
}

async function checkVirusTotal(url) {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) return null;
  const id = Buffer.from(url.href).toString('base64url');
  try {
    const response = await fetchJson(`https://www.virustotal.com/api/v3/urls/${id}`, {
      headers: { accept: 'application/json', 'x-apikey': apiKey },
    });
    if (response.status === 404) return { provider: 'VirusTotal', verdict: 'Unrated', detail: 'No existing VirusTotal report' };
    const stats = response.body?.data?.attributes?.last_analysis_stats || {};
    const malicious = Number(stats.malicious || 0);
    const suspicious = Number(stats.suspicious || 0);
    const harmless = Number(stats.harmless || 0);
    const verdict = malicious > 0 ? 'Malicious' : suspicious > 0 ? 'Suspicious' : harmless > 0 ? 'No engines flagged it' : 'Unrated';
    return { provider: 'VirusTotal', verdict, malicious, suspicious, harmless, detail: `${malicious} malicious · ${suspicious} suspicious · ${harmless} harmless` };
  } catch (error) {
    return { provider: 'VirusTotal', verdict: 'Unavailable', detail: error.name === 'AbortError' ? 'Timed out' : 'Provider request failed' };
  }
}

async function checkGoogleWebRisk(url) {
  const apiKey = process.env.GOOGLE_WEB_RISK_API_KEY?.trim();
  if (!apiKey) return null;
  const query = new URLSearchParams({ uri: url.href, key: apiKey });
  for (const threat of ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']) query.append('threatTypes', threat);
  try {
    const { body } = await fetchJson(`https://webrisk.googleapis.com/v1/uris:search?${query}`);
    const threats = body?.threat?.threatTypes || [];
    return {
      provider: 'Google Web Risk',
      verdict: threats.length ? 'Malicious' : 'No match',
      threats,
      detail: threats.length ? threats.join(', ').replaceAll('_', ' ') : 'Not found on configured threat lists',
    };
  } catch (error) {
    return { provider: 'Google Web Risk', verdict: 'Unavailable', detail: error.name === 'AbortError' ? 'Timed out' : 'Provider request failed' };
  }
}

export function reputationConfigured() {
  return Boolean(process.env.VIRUSTOTAL_API_KEY?.trim() || process.env.GOOGLE_WEB_RISK_API_KEY?.trim());
}

export async function checkUrlReputation(urls) {
  const configured = reputationConfigured();
  if (!configured || !urls.length) return { configured, checked: 0, results: [] };
  const selected = urls.slice(0, MAX_EXTERNAL_URLS);
  const results = await Promise.all(selected.map(async (url) => {
    const privacySafeUrl = new URL(url.href);
    privacySafeUrl.username = '';
    privacySafeUrl.password = '';
    privacySafeUrl.search = '';
    privacySafeUrl.hash = '';
    const providers = (await Promise.all([checkVirusTotal(privacySafeUrl), checkGoogleWebRisk(privacySafeUrl)])).filter(Boolean);
    const malicious = providers.some((item) => item.verdict === 'Malicious');
    const suspicious = providers.some((item) => item.verdict === 'Suspicious');
    return { url: privacySafeUrl.href, host: url.hostname.replace(/^www\./, ''), verdict: malicious ? 'Malicious' : suspicious ? 'Suspicious' : 'No external threat match', providers };
  }));
  return { configured, checked: selected.length, results };
}
