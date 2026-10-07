import { Router, raw } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import ChatThread from '../models/ChatThread.js';
import ChatMessage from '../models/ChatMessage.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import { chatMediaStore } from '../services/chatMediaStore.js';
import { MAX_CHAT_UPLOAD_BYTES, chatFileTypes, validateChatFile, parseMediaRange } from '../utils/chatMedia.js';

const router = Router();
router.use(requireAuth);
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const isManager = (user) => ['staff', 'admin'].includes(user.role);
const messageLimit = rateLimit({ windowMs: 60_000, limit: 15, keyGenerator: (req) => req.ip + ':' + req.user._id, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Please wait a moment before sending more messages.' } });
const uploadLimit = rateLimit({ windowMs: 60_000, limit: 6, keyGenerator: (req) => req.ip + ':' + req.user._id, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Please wait before uploading more files.' } });

async function accessibleThread(req) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return null;
  const thread = await ChatThread.findOne({ _id: req.params.id, ...(isManager(req.user) ? {} : { user: req.user._id }) }).populate('user', 'name email role isGuest').lean();
  if (!thread?.user || thread.user.role !== 'user' || thread.user.isGuest) return null;
  return thread;
}

router.get('/staff', async (_req, res, next) => {
  try {
    const staff = await User.find({ role: { $in: ['staff', 'admin'] }, isActive: true, isGuest: { $ne: true } }).select('name role').sort({ role: -1, name: 1 }).limit(30).lean();
    res.json({ staff: staff.map((person) => ({ id: person._id, name: person.name, role: person.role })) });
  } catch (error) { next(error); }
});

router.post('/threads/:id/attachments', uploadLimit, async (req, res, next) => {
  try {
    const thread = await accessibleThread(req);
    if (!thread) return res.status(404).json({ message: 'Conversation not found.' });
    const type = String(req.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!chatFileTypes[type]) return res.status(415).json({ message: 'This file type is not supported.' });
    req.chatThread = thread;
    next();
  } catch (error) { next(error); }
}, raw({ type: () => true, limit: MAX_CHAT_UPLOAD_BYTES }), async (req, res, next) => {
  try {
    let name;
    try { name = decodeURIComponent(req.get('X-File-Name') || ''); } catch { return res.status(400).json({ message: 'Invalid filename.' }); }
    const file = validateChatFile(req.body, req.get('Content-Type'), name);
    const attachment = await chatMediaStore.save(req.body, file, req.chatThread._id, req.user._id);
    if (res.destroyed) { await chatMediaStore.removePending(attachment._id, req.chatThread._id, req.user._id); return; }
    res.status(201).json({ attachment });
  } catch (error) { next(error); }
});

router.delete('/threads/:id/attachments/:fileId', async (req, res, next) => {
  try {
    const thread = await accessibleThread(req);
    if (!thread || !mongoose.isObjectIdOrHexString(req.params.fileId)) return res.status(404).json({ message: 'Attachment not found.' });
    if (!await chatMediaStore.removePending(req.params.fileId, thread._id, req.user._id)) return res.status(404).json({ message: 'Only your unsent attachments can be removed.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/threads/:id/attachments/:fileId', async (req, res, next) => {
  try {
    const thread = await accessibleThread(req);
    if (!thread || !mongoose.isObjectIdOrHexString(req.params.fileId)) return res.status(404).json({ message: 'Attachment not found.' });
    if (!await ChatMessage.exists({ thread: thread._id, 'attachments._id': req.params.fileId })) return res.status(404).json({ message: 'Attachment not found.' });
    const file = await chatMediaStore.get(req.params.fileId, thread._id);
    if (!file) return res.status(404).json({ message: 'Attachment not found.' });
    const range = parseMediaRange(req.get('Range'), file.length);
    if (range?.invalid) return res.status(416).set('Content-Range', 'bytes */' + file.length).end();
    const encodedName = encodeURIComponent(file.filename).replace(/['()*]/g, (character) => '%' + character.charCodeAt(0).toString(16));
    const disposition = file.metadata.kind === 'file' || req.query.download === '1' ? 'attachment' : 'inline';
    res.set({ 'Content-Type': file.metadata.contentType, 'Content-Disposition': disposition + "; filename*=UTF-8''" + encodedName, 'Accept-Ranges': 'bytes', 'Content-Security-Policy': "sandbox; default-src 'none'" });
    if (range) res.status(206).set({ 'Content-Range': `bytes ${range.start}-${range.end}/${file.length}`, 'Content-Length': String(range.end - range.start + 1) });
    else res.set('Content-Length', String(file.length));
    const stream = chatMediaStore.open(file._id, range);
    res.on('close', () => stream.destroy());
    stream.on('error', next); stream.pipe(res);
  } catch (error) { next(error); }
});

router.get('/threads', async (req, res, next) => {
  try {
    const scope = isManager(req.user)
      ? { user: { $in: await User.distinct('_id', { role: 'user', isGuest: { $ne: true } }) } }
      : { user: req.user._id };
    const limit = 30;
    const total = await ChatThread.countDocuments(scope);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(pages, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
    const threads = await ChatThread.find(scope).populate('user', 'name email').sort({ lastMessageAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.json({ threads, total, page, pages });
  } catch (error) { next(error); }
});

router.post('/threads', async (req, res, next) => {
  try {
    if (req.user.role !== 'user') return res.status(403).json({ message: 'Members start conversations. Staff reply through their inbox.' });
    const thread = await ChatThread.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json({ thread });
  } catch (error) { next(error); }
});

router.get('/threads/:id/messages', async (req, res, next) => {
  try {
    const thread = await accessibleThread(req);
    if (!thread) return res.status(404).json({ message: 'Conversation not found.' });
    if (req.query.before && !mongoose.isObjectIdOrHexString(req.query.before)) return res.status(400).json({ message: 'Invalid message cursor.' });
    const scope = { thread: thread._id, ...(req.query.before ? { _id: { $lt: req.query.before } } : {}) };
    const rows = await ChatMessage.find(scope).sort({ _id: -1 }).limit(51).lean();
    const messages = rows.slice(0, 50).reverse();
    res.json({ messages, hasOlder: rows.length > 50 });
  } catch (error) { next(error); }
});

router.post('/threads/:id/messages', messageLimit, async (req, res, next) => {
  let attachments = [];
  let created = false;
  try {
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    const ids = req.body.attachments === undefined ? [] : req.body.attachments;
    if (!Array.isArray(ids) || ids.length > 3 || new Set(ids).size !== ids.length || ids.some((id) => !mongoose.isObjectIdOrHexString(id))) return res.status(400).json({ message: 'Choose up to three valid attachments.' });
    if ((!body && !ids.length) || body.length > 2000 || (req.body.body !== undefined && typeof req.body.body !== 'string')) return res.status(400).json({ message: 'Write up to 2,000 characters or attach a file.' });
    const thread = await accessibleThread(req);
    if (!thread) return res.status(404).json({ message: 'Conversation not found.' });
    attachments = await chatMediaStore.claim(ids, thread._id, req.user._id);
    const message = await ChatMessage.create({ thread: thread._id, sender: req.user._id, senderName: req.user.name, senderRole: req.user.role, body, attachments });
    created = true;
    await chatMediaStore.publish(ids).catch((error) => console.error('Attachment publication marker failed:', error.message));
    // A delayed request must not replace the preview of a newer message.
    await ChatThread.updateOne({ _id: thread._id, lastMessageAt: { $lte: message.createdAt } }, { $set: { lastMessageAt: message.createdAt, lastMessagePreview: body.slice(0, 160) || 'Attachment · ' + attachments[0]?.name, lastSenderRole: req.user.role } }).catch((error) => console.error('Chat preview update failed:', error.message));
    await recordAudit(req, 'chat.message_sent', { targetType: 'chat_thread', targetId: thread._id });
    res.status(201).json({ message });
  } catch (error) { if (!created) await chatMediaStore.release(attachments.map((file) => file._id)).catch(() => {}); next(error); }
});

export default router;
