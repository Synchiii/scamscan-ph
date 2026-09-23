export function classifyThreat(score) {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

export function scoreSecurityEvent(input) {
  const event = {
    failedAttempts: Number(input.failedAttempts) || 0,
    fileCount: Number(input.fileCount) || 0,
    isNewDevice: Boolean(input.isNewDevice),
    isUnknownIp: Boolean(input.isUnknownIp),
    isUnusualTime: Boolean(input.isUnusualTime),
    restrictedFolder: Boolean(input.restrictedFolder),
    portScan: Boolean(input.portScan),
    unusualTraffic: Boolean(input.unusualTraffic),
  };
  let score = 0;
  const factors = [];
  const add = (condition, points, factor) => { if (condition) { score += points; factors.push(factor); } };
  add(event.failedAttempts > 0 && event.failedAttempts < 5, 5, 'Failed login');
  add(event.failedAttempts >= 5, 20, 'Multiple failed logins');
  add(event.isNewDevice, 15, 'New device');
  add(event.isUnknownIp, 15, 'Unknown IP address');
  add(event.isUnusualTime, 10, 'Unusual login time');
  add(event.restrictedFolder, 20, 'Restricted file accessed');
  add(event.fileCount >= 100, 30, 'Mass file modification');
  add(event.fileCount >= 25 && event.fileCount < 100, 15, 'Unusual file activity');
  add(event.portScan, 25, 'Port-scanning signs');
  add(event.unusualTraffic, 20, 'Unusual traffic volume');
  score = Math.min(score, 100);
  const severity = classifyThreat(score);
  const summary = factors.length
    ? `${input.type} activity scored ${score}/100: ${factors.join(', ')}.`
    : `${input.type} activity recorded with no elevated rule-based signals.`;
  return { score, severity, factors, summary };
}
