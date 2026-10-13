export const RISK_LEVELS = ['Scam', 'High', 'Warning', 'Low Risk', 'Safe'];

export function riskClass(level) {
  return String(level || '').toLowerCase().replaceAll(' ', '-');
}

export function riskLabel(level) {
  if (level === 'Low Risk') return 'Low Risk — Monitor';
  if (level === 'Scam') return 'Scam Likely';
  return level;
}
