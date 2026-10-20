export const validEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validPhinmaStudentEmail = (value) => validEmail(value) && value.toLowerCase().endsWith('@phinmaed.com');
export const validPassword = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128 && !/\s/.test(value);
export const passwordHelp = 'Use 8–128 characters without spaces.';
export const validOtp = (value) => typeof value === 'string' && /^\d{6}$/.test(value);
