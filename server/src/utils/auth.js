import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'sentinel_session';

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required. Add it to server/.env.');
  return process.env.JWT_SECRET;
}

export function signSession(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret(), { expiresIn: '7d' });
}

export function verifySession(token) { return jwt.verify(token, secret()); }

export function setSessionCookie(res, user) {
  res.cookie(COOKIE_NAME, signSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
}

export { COOKIE_NAME };
