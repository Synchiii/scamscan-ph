export function normalizePersonName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function personNameIssue(value) {
  const name = normalizePersonName(value);
  const letterCount = (name.match(/\p{L}/gu) || []).length;
  if (name.length < 2 || name.length > 80) return 'Full name must be between 2 and 80 characters.';
  if (letterCount < 2 || !/^[\p{L}\p{M}][\p{L}\p{M} .'-]*[\p{L}\p{M}.]$/u.test(name)) return 'Use letters, spaces, periods, apostrophes, or hyphens only. Numbers are not allowed.';
  return '';
}
