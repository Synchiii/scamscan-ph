import { Router } from 'express';
import User from '../models/User.js';
import SupportMessage from '../models/SupportMessage.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import { sendSupportNotification } from '../services/emailService.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res, next) => {
  try {
    if (req.user.isGuest) return res.status(403).json({ message: 'Create an account to send a private support request.' });
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();
    if (subject.length < 3 || subject.length > 140) return res.status(400).json({ message: 'Use a subject between 3 and 140 characters.' });
    if (message.length < 10 || message.length > 4000) return res.status(400).json({ message: 'Describe your concern in 10 to 4,000 characters.' });
    const support = await SupportMessage.create({ from: req.user._id, senderName: req.user.name, senderEmail: req.user.email, subject, message });
    await recordAudit(req, 'support.request_created', { targetType: 'support_message', targetId: support._id, details: subject });
    const admins = await User.find({ role: 'admin', isActive: true }).select('email').lean();
    await Promise.allSettled(admins.map((admin) => sendSupportNotification({ to: admin.email, senderName: req.user.name, senderEmail: req.user.email, subject, message })));
    return res.status(201).json({ support });
  } catch (error) { next(error); }
});

router.get('/mine', async (req, res, next) => {
  try {
    const support = await SupportMessage.find({ from: req.user._id }).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ support });
  } catch (error) { next(error); }
});

export default router;
