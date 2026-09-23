import { Router } from 'express';
import MessageAnalysis from '../models/MessageAnalysis.js';
import { scoreScamMessage } from '../services/scamScorer.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';

const router = Router();

router.post('/analyze', requireAuth, async (req, res, next) => {
  try {
    const message = String(req.body.message || '').trim();
    if (message.length < 10) return res.status(400).json({ message: 'Enter a message with at least 10 characters.' });
    if (message.length > 5000) return res.status(400).json({ message: 'Messages may not exceed 5,000 characters.' });
    const result = scoreScamMessage(message);
    const saved = await MessageAnalysis.create({ user: req.user._id, message, ...result });
    await recordAudit(req, 'scan.created', { targetType: 'analysis', targetId: saved._id, details: `${result.level} risk score ${result.score}` });
    res.status(201).json({ id: saved._id, ...result, createdAt: saved.createdAt });
  } catch (error) { next(error); }
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const limit = 10;
    const level = ['Safe', 'Warning', 'High', 'Scam'].includes(req.query.level) ? req.query.level : null;
    const query = { user: req.user._id, ...(level ? { level } : {}) };
    const [analyses, total] = await Promise.all([
      MessageAnalysis.find(query).select('message language score level flags signals explanation recommendation createdAt updatedAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      MessageAnalysis.countDocuments(query),
    ]);
    res.json({ analyses, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) { next(error); }
});

router.delete('/history/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await MessageAnalysis.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Saved check not found.' });
    await recordAudit(req, 'scan.deleted', { targetType: 'analysis', targetId: deleted._id });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/analytics', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, byLevel, byLanguage, average, highRisk, rawFlags, trend, byAccountType, reviewed] = await Promise.all([
      MessageAnalysis.countDocuments(),
      MessageAnalysis.aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      MessageAnalysis.aggregate([{ $group: { _id: '$language', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      MessageAnalysis.aggregate([{ $group: { _id: null, value: { $avg: '$score' } } }]),
      MessageAnalysis.countDocuments({ level: { $in: ['High', 'Scam'] } }),
      MessageAnalysis.aggregate([{ $unwind: '$flags' }, { $group: { _id: '$flags', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
      MessageAnalysis.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      MessageAnalysis.aggregate([{ $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'account' } }, { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } }, { $group: { _id: { $cond: [{ $eq: ['$account.isGuest', true] }, 'Guest', 'Member'] }, count: { $sum: 1 } } }]),
      MessageAnalysis.countDocuments({ 'adminReview.reviewedAt': { $exists: true } }),
    ]);
    const scams = await MessageAnalysis.countDocuments({ level: 'Scam' });
    res.json({ total, scams, reviewed, averageScore: Math.round(average[0]?.value || 0), highRiskRate: total ? Math.round((highRisk / total) * 100) : 0, byLevel, byLanguage, commonFlags: rawFlags, trend, byAccountType });
  } catch (error) { next(error); }
});

export default router;
