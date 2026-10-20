const allowedNameCharacters = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*[\p{L}\p{M}.]$/u;

export function normalizePersonName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function validPersonName(value) {
  const name = normalizePersonName(value);
  const letterCount = (name.match(/\p{L}/gu) || []).length;
  return name.length >= 2 && name.length <= 80 && letterCount >= 2 && allowedNameCharacters.test(name);
}

export const personNameHelp = "Enter your full name using letters, spaces, periods, apostrophes, or hyphens only. Numbers are not allowed.";
