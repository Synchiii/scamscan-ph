import { Router } from 'express';
import Content from '../models/Content.js';
import User from '../models/User.js';
import SupportMessage from '../models/SupportMessage.js';
import { requireAuth, requireStaff } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';

const router = Router();
router.use(requireAuth, requireStaff);

function contentInput(body) {
  const input = { title: String(body.title || '').trim(), body: String(body.body || '').trim(), category: body.category, status: body.status };
  if (input.title.length < 3 || input.title.length > 120 || input.body.length < 10 || input.body.length > 5000 || !['guide', 'announcement', 'news'].includes(input.category) || !['draft', 'published'].includes(input.status)) return null;
  return input;
}
router.get('/overview', async (_req, res, next) => {
  try {
    const [users, contents, openSupport] = await Promise.all([
      User.countDocuments({ role: 'user', isGuest: { $ne: true } }),
      Content.countDocuments(),
      SupportMessage.countDocuments({ status: { $ne: 'resolved' } }),
    ]);
    res.json({ users, contents, openSupport });
  } catch (error) { next(error); }
});
router.get('/content', async (_req, res, next) => {
  try { res.json({ contents: await Content.find().sort({ updatedAt: -1 }).limit(200).lean() }); }
  catch (error) { next(error); }
});
router.post('/content', async (req, res, next) => {
  try {
    const input = contentInput(req.body);
    if (!input) return res.status(400).json({ message: 'Check the content title, body, category, and publication status.' });
    const content = await Content.create({ ...input, updatedBy: req.user._id });
    await recordAudit(req, req.user.role + '.content_created', { targetType: 'content', targetId: content._id });
    res.status(201).json({ content });
  } catch (error) { next(error); }
});
router.patch('/content/:id', async (req, res, next) => {
  try {
    const input = contentInput(req.body);
    if (!input) return res.status(400).json({ message: 'Check the content title, body, category, and publication status.' });
    const content = await Content.findByIdAndUpdate(req.params.id, { ...input, updatedBy: req.user._id }, { new: true, runValidators: true });
    if (!content) return res.status(404).json({ message: 'Content not found.' });
    await recordAudit(req, req.user.role + '.content_updated', { targetType: 'content', targetId: content._id });
    res.json({ content });
  } catch (error) { next(error); }
});
router.delete('/content/:id', async (req, res, next) => {
  try {
    const content = await Content.findByIdAndDelete(req.params.id);
    if (!content) return res.status(404).json({ message: 'Content not found.' });
    await recordAudit(req, req.user.role + '.content_deleted', { targetType: 'content', targetId: content._id });
    res.status(204).end();
  } catch (error) { next(error); }
});
export default router;
