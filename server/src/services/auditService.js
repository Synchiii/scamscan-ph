import AuditLog from '../models/AuditLog.js';

export function recordAudit(req, action, { targetType = '', targetId = '', details = '' } = {}) {
  const user = req.user;
  return AuditLog.create({
    actor: user?._id,
    actorName: user?.name || 'System',
    actorEmail: user?.email || 'system@scamscan.local',
    actorRole: user ? (user.isGuest ? 'guest' : user.role) : 'system',
    action,
    targetType,
    targetId: String(targetId || ''),
    details,
    ip: req.ip || '',
  }).catch((error) => console.error('Audit log failed:', error.message));
}
