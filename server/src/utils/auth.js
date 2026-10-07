import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'sentinel_session';
const DEFAULT_SESSION_HOURS = 0.5;
const MAX_SESSION_HOURS = 0.5;

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required. Add it to server/.env.');
  return process.env.JWT_SECRET;
}

export function signSession(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    secret(),
    { expiresIn: Math.floor(getSessionDurationMs() / 1000) },
  );
}

export function verifySession(token) {
  return jwt.verify(token, secret(), { algorithms: ['HS256'], maxAge: Math.floor(getSessionDurationMs() / 1000) });
}

export function setSessionCookie(res, user) {
  const production = process.env.NODE_ENV === 'production';
  const token = signSession(user);
  const { exp } = verifySession(token);
  const expiresAt = exp * 1000;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    // The Vercel client and Render API are different sites in production.
    // Cross-site API requests need an explicit secure cookie policy.
    sameSite: production ? 'none' : 'lax',
    secure: production,
    maxAge: Math.max(0, expiresAt - Date.now()),
    path: '/',
  });
  return new Date(expiresAt).toISOString();
}

export function getSessionDurationMs() {
  const configuredHours = Number(process.env.SESSION_TTL_HOURS || DEFAULT_SESSION_HOURS);
  const hours = Number.isFinite(configuredHours) && configuredHours > 0 && configuredHours <= MAX_SESSION_HOURS
    ? configuredHours
    : DEFAULT_SESSION_HOURS;
  return Math.max(1000, Math.floor(hours * 60 * 60) * 1000);
}

export function clearSessionCookie(res) {
  const production = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: production ? 'none' : 'lax', secure: production, path: '/' });
}

export { COOKIE_NAME };
