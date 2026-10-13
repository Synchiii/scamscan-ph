import { Router } from 'express';
import MessageAnalysis from '../models/MessageAnalysis.js';
import User from '../models/User.js';
import { registeredAccounts } from '../utils/access.js';
import { applyUrlReputation, extractUrls, scoreScamMessage } from '../services/scamScorer.js';
import { checkUrlReputation } from '../services/urlReputation.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';

const router = Router();

router.post('/analyze', requireAuth, async (req, res, next) => {
  try {
    const message = String(req.body.message || '').trim();
    const sourceType = ['text', 'url', 'image'].includes(req.body.sourceType) ? req.body.sourceType : 'text';
    const ocrConfidence = sourceType === 'image' && Number.isFinite(Number(req.body.ocrConfidence)) ? Math.max(0, Math.min(100, Math.round(Number(req.body.ocrConfidence)))) : null;
    if (message.length < 10) return res.status(400).json({ message: 'Enter a message with at least 10 characters.' });
    if (message.length > 5000) return res.status(400).json({ message: 'Messages may not exceed 5,000 characters.' });
    const localResult = scoreScamMessage(message);
    const reputation = await checkUrlReputation(extractUrls(message));
    const result = applyUrlReputation(localResult, reputation);
    if (ocrConfidence !== null && ocrConfidence < 60) {
      result.confidence = Math.max(20, result.confidence - Math.round((60 - ocrConfidence) / 2));
      result.confidenceLevel = result.confidence >= 75 ? 'High' : result.confidence >= 50 ? 'Moderate' : 'Low';
      result.explanation += ' OCR confidence was limited, so verify the extracted screenshot text before acting.';
    }
    const saved = await MessageAnalysis.create({ user: req.user._id, message, sourceType, ocrConfidence, ...result });
    await recordAudit(req, 'scan.created', { targetType: 'analysis', targetId: saved._id, details: `${result.level} risk score ${result.score}` });
    res.status(201).json({ id: saved._id, sourceType, ocrConfidence, ...result, createdAt: saved.createdAt });
  } catch (error) { next(error); }
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const limit = 10;
    const level = ['Safe', 'Low Risk', 'Warning', 'High', 'Scam'].includes(req.query.level) ? req.query.level : null;
    const query = { user: req.user._id, ...(level ? { level } : {}) };
    const total = await MessageAnalysis.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(pages, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
    const analyses = await MessageAnalysis.find(query).select('message sourceType ocrConfidence language score level confidence confidenceLevel analysisVersion flags signals urls externalChecks explanation recommendation createdAt updatedAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.json({ analyses, total, page, pages });
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
    const visibleUsers = await User.distinct('_id', registeredAccounts);
    const visible = { user: { $in: visibleUsers } };
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, byLevel, byLanguage, average, highRisk, rawFlags, trend, byAccountType, reviewed] = await Promise.all([
      MessageAnalysis.countDocuments(visible),
      MessageAnalysis.aggregate([{ $match: visible }, { $group: { _id: '$level', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      MessageAnalysis.aggregate([{ $match: visible }, { $group: { _id: '$language', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      MessageAnalysis.aggregate([{ $match: visible }, { $group: { _id: null, value: { $avg: '$score' } } }]),
      MessageAnalysis.countDocuments({ ...visible, level: { $in: ['High', 'Scam'] } }),
      MessageAnalysis.aggregate([{ $match: visible }, { $unwind: '$flags' }, { $group: { _id: '$flags', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
      MessageAnalysis.aggregate([{ $match: visible }, { $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      MessageAnalysis.aggregate([{ $match: visible }, { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'account' } }, { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } }, { $group: { _id: { $ifNull: ['$account.role', 'user'] }, count: { $sum: 1 } } }]),
      MessageAnalysis.countDocuments({ ...visible, 'adminReview.reviewedAt': { $exists: true } }),
    ]);
    const scams = await MessageAnalysis.countDocuments({ ...visible, level: 'Scam' });
    res.json({ total, scams, reviewed, averageScore: Math.round(average[0]?.value || 0), highRiskRate: total ? Math.round((highRisk / total) * 100) : 0, byLevel, byLanguage, commonFlags: rawFlags, trend, byAccountType });
  } catch (error) { next(error); }
});

export default router;
