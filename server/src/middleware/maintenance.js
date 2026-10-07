import SiteSettings, { DEFAULT_MAINTENANCE_MESSAGE } from '../models/SiteSettings.js';
import User from '../models/User.js';
import { COOKIE_NAME, verifySession } from '../utils/auth.js';

const alwaysAvailable = new Set(['/health', '/site/status', '/auth/login', '/auth/logout', '/auth/forgot-password', '/auth/reset-password']);

export async function maintenanceGuard(req, res, next) {
  try {
    if (alwaysAvailable.has(req.path) || req.method === 'OPTIONS') return next();
    const settings = await SiteSettings.findOne({ key: 'site' }).lean();
    if (!settings?.maintenanceEnabled) return next();
    let administrator = false;
    try {
      const payload = verifySession(req.cookies?.[COOKIE_NAME]);
      administrator = Boolean(await User.exists({ _id: payload.sub, role: 'admin', isActive: true, isGuest: { $ne: true } }));
    } catch { /* Only a valid administrator session bypasses maintenance. */ }
    if (administrator) return next();
    res.set('Retry-After', '60');
    return res.status(503).json({ code: 'MAINTENANCE_MODE', message: settings.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE });
  } catch (error) { next(error); }
}
