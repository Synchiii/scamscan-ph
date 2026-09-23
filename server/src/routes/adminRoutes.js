import { Router } from 'express';
import User from '../models/User.js';
import MessageAnalysis from '../models/MessageAnalysis.js';
import SecurityEvent from '../models/SecurityEvent.js';
import SupportMessage from '../models/SupportMessage.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import { sendSupportReplyEmail } from '../services/emailService.js';

const router = Router();
router.use(requireAuth, requireAdmin);
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, isGuest: user.isGuest, emailVerified: user.emailVerified, isActive: user.isActive, preferences: user.preferences, createdAt: user.createdAt, updatedAt: user.updatedAt });
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.get('/overview', async (_req, res, next) => {
  try {
    const [accounts, guests, verified, reports, openSupport, latestAudit] = await Promise.all([
      User.countDocuments({ isGuest: false }), User.countDocuments({ isGuest: true }), User.countDocuments({ emailVerified: true, isGuest: false }),
      MessageAnalysis.countDocuments(), SupportMessage.countDocuments({ status: { $ne: 'resolved' } }), AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
    ]);
    res.json({ accounts, guests, verified, reports, openSupport, latestAudit });
  } catch (error) { next(error); }
});

router.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find({ isGuest: false }).select('name email role isGuest emailVerified isActive createdAt updatedAt').sort({ createdAt: -1 }).lean();
    res.json({ users: users.map((user) => ({ ...user, id: user._id })) });
  } catch (error) { next(error); }
});

router.get('/users/:id/details', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name email role isGuest emailVerified isActive preferences createdAt updatedAt').lean();
    if (!user || user.isGuest) return res.status(404).json({ message: 'Account not found.' });
    const [analyses, events, support, audit] = await Promise.all([
      MessageAnalysis.find({ user: user._id }).sort({ createdAt: -1 }).limit(100).lean(), SecurityEvent.find({ submittedBy: user._id }).sort({ createdAt: -1 }).limit(100).lean(),
      SupportMessage.find({ from: user._id }).sort({ createdAt: -1 }).limit(50).lean(), AuditLog.find({ actor: user._id }).sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    await recordAudit(req, 'admin.account_details_viewed', { targetType: 'user', targetId: user._id, details: user.email });
    res.json({ user: { ...user, id: user._id }, analyses, events, support, audit });
  } catch (error) { next(error); }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target || target.isGuest) return res.status(404).json({ message: 'Account not found.' });
    const updates = {};
    if (typeof req.body.name === 'string') {
      const name = req.body.name.trim();
      if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
      updates.name = name;
    }
    if (typeof req.body.email === 'string') {
      const email = req.body.email.trim().toLowerCase();
      if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
      if (await User.exists({ email, _id: { $ne: target._id } })) return res.status(409).json({ message: 'Another account already uses that email.' });
      updates.email = email;
    }
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (['user', 'admin'].includes(req.body.role)) updates.role = req.body.role;
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'Enter an account update to save.' });
    if (target._id.toString() === req.user._id.toString() && (updates.isActive === false || updates.role === 'user')) return res.status(400).json({ message: 'You cannot remove your own administrator access.' });
    Object.assign(target, updates);
    await target.save();
    await recordAudit(req, 'admin.account_updated', { targetType: 'user', targetId: target._id, details: Object.keys(updates).join(', ') });
    res.json({ user: publicUser(target) });
  } catch (error) { next(error); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: 'You cannot delete your own administrator account.' });
    const user = await User.findOneAndDelete({ _id: req.params.id, isGuest: false });
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    await Promise.all([MessageAnalysis.deleteMany({ user: user._id }), SecurityEvent.deleteMany({ submittedBy: user._id }), SupportMessage.deleteMany({ from: user._id })]);
    await recordAudit(req, 'admin.account_deleted', { targetType: 'user', targetId: user._id, details: user.email });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/reports', async (_req, res, next) => {
  try {
    const page = Math.max(1, Math.min(10000, Number.parseInt(_req.query.page, 10) || 1));
    const limit = 20;
    const level = ['Safe', 'Warning', 'High', 'Scam'].includes(_req.query.level) ? _req.query.level : null;
    const query = level ? { level } : {};
    const [reports, total] = await Promise.all([
      MessageAnalysis.find(query).populate('user', 'name email isGuest role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      MessageAnalysis.countDocuments(query),
    ]);
    res.json({ reports, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) { next(error); }
});
router.patch('/reports/:id', async (req, res, next) => {
  try {
    const report = await MessageAnalysis.findById(req.params.id).populate('user', 'name email isGuest role');
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    const score = Number(req.body.score);
    const level = req.body.level;
    const explanation = String(req.body.explanation || '').trim();
    const recommendation = String(req.body.recommendation || '').trim();
    const note = String(req.body.note || '').trim();
    if (!Number.isInteger(score) || score < 0 || score > 100 || !['Safe', 'Warning', 'High', 'Scam'].includes(level)) return res.status(400).json({ message: 'Enter a valid score and risk level.' });
    if (explanation.length < 10 || explanation.length > 1000 || recommendation.length < 10 || recommendation.length > 1000 || note.length > 500) return res.status(400).json({ message: 'Explanation and recommendation must be 10–1,000 characters; review note at most 500.' });
    report.score = score;
    report.level = level;
    report.explanation = explanation;
    report.recommendation = recommendation;
    report.adminReview = { by: req.user._id, byName: req.user.name, note, reviewedAt: new Date() };
    await report.save();
    await recordAudit(req, 'admin.report_updated', { targetType: 'analysis', targetId: report._id, details: `Risk ${level}, score ${score}` });
    res.json({ report });
  } catch (error) { next(error); }
});
router.get('/audit-logs', async (_req, res, next) => {
  try { res.json({ logs: await AuditLog.find().sort({ createdAt: -1 }).limit(250).lean() }); } catch (error) { next(error); }
});
router.get('/support', async (_req, res, next) => {
  try { res.json({ support: await SupportMessage.find().populate('from', 'name email isGuest role').sort({ createdAt: -1 }).limit(150).lean() }); } catch (error) { next(error); }
});
router.patch('/support/:id', async (req, res, next) => {
  try {
    if (!['open', 'in-progress', 'resolved'].includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid support status.' });
    const support = await SupportMessage.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!support) return res.status(404).json({ message: 'Support request not found.' });
    await recordAudit(req, 'admin.support_status_updated', { targetType: 'support_message', targetId: support._id, details: support.status });
    res.json({ support });
  } catch (error) { next(error); }
});

router.post('/support/:id/reply', async (req, res, next) => {
  try {
    const body = String(req.body.body || '').trim();
    if (body.length < 10 || body.length > 4000) return res.status(400).json({ message: 'Reply must be between 10 and 4,000 characters.' });
    const support = await SupportMessage.findById(req.params.id);
    if (!support) return res.status(404).json({ message: 'Support request not found.' });
    support.replies.push({ body, by: req.user._id, byName: req.user.name });
    if (support.status === 'open') support.status = 'in-progress';
    await support.save();
    await recordAudit(req, 'admin.support_replied', { targetType: 'support_message', targetId: support._id });
    let emailed = false;
    try { emailed = await sendSupportReplyEmail({ to: support.senderEmail, name: support.senderName, subject: support.subject, reply: body }); }
    catch (error) { console.error('Support reply email failed:', error.message); }
    res.json({ support, emailed });
  } catch (error) { next(error); }
});

export default router;
