import User from '../models/User.js';
import { COOKIE_NAME, verifySession } from '../utils/auth.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = verifySession(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ message: 'Your session is no longer valid.' });
    req.user = user;
    next();
  } catch (_error) { return res.status(401).json({ message: 'Your session is invalid or has expired.' }); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
  next();
}
