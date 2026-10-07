import User from '../models/User.js';
import { clearSessionCookie, COOKIE_NAME, getSessionDurationMs, verifySession } from '../utils/auth.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = verifySession(token);
    const user = await User.findOne({ _id: payload.sub, isGuest: { $ne: true } });
    if (!user || !user.isActive || user.role !== payload.role) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Your session is no longer valid.' });
    }
    req.user = user;
    req.sessionExpiresAt = new Date(Math.min(payload.exp * 1000, payload.iat * 1000 + getSessionDurationMs())).toISOString();
    next();
  } catch (_error) {
    clearSessionCookie(res);
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
  next();
}

export function requireStaff(req, res, next) {
  if (!['staff', 'admin'].includes(req.user?.role)) return res.status(403).json({ message: 'Staff access is required.' });
  next();
}
