export const validEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validPassword = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128 && !/\s/.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value);
export const passwordHelp = 'Use 8–128 characters with a letter and a number, without spaces.';
export const validOtp = (value) => typeof value === 'string' && /^\d{6}$/.test(value);
