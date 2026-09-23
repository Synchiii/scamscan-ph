import { Router } from 'express';
import SecurityEvent from '../models/SecurityEvent.js';
import { scoreSecurityEvent } from '../services/threatScorer.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const allowedTypes = ['login', 'file', 'network', 'behavior'];
router.use(requireAuth, requireAdmin);

function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }

async function applyBehaviorBaseline(input) {
  const history = await SecurityEvent.find({ actor: input.actor }).sort({ occurredAt: -1 }).limit(50).lean();
  if (history.length < 3) return { ...input, baselineFlags: [] };
  const baselineFlags = [];
  const enriched = { ...input };
  const knownDevices = new Set(history.map((event) => event.device).filter((device) => device && device !== 'Not recorded'));
  if (input.device && input.device !== 'Not recorded' && !knownDevices.has(input.device) && !input.isNewDevice) {
    enriched.isNewDevice = true;
    baselineFlags.push('Device differs from this user’s historical baseline');
  }
  const observedHour = new Date(input.occurredAt || Date.now()).getUTCHours();
  const usualHours = history.map((event) => new Date(event.occurredAt).getUTCHours());
  const isNearUsualHour = usualHours.some((hour) => Math.min(Math.abs(hour - observedHour), 24 - Math.abs(hour - observedHour)) <= 3);
  if (!isNearUsualHour && !input.isUnusualTime) {
    enriched.isUnusualTime = true;
    baselineFlags.push('Activity time differs from this user’s historical baseline');
  }
  const fileEvents = history.filter((event) => event.type === 'file');
  const averageFiles = fileEvents.reduce((sum, event) => sum + event.fileCount, 0) / fileEvents.length;
  if (input.type === 'file' && averageFiles > 0 && Number(input.fileCount) >= Math.max(25, averageFiles * 4)) {
    baselineFlags.push('File volume is far above this user’s historical baseline');
  }
  return { ...enriched, baselineFlags };
}

router.post('/events', async (req, res, next) => {
  try {
    const type = String(req.body.type || '');
    const actor = String(req.body.actor || '').trim();
    if (!allowedTypes.includes(type)) return res.status(400).json({ message: 'Choose a valid event type.' });
    if (!actor || actor.length > 100) return res.status(400).json({ message: 'Provide an actor between 1 and 100 characters.' });
    const enriched = await applyBehaviorBaseline({ ...req.body, type, actor });
    const scored = scoreSecurityEvent(enriched);
    const factors = [...new Set([...scored.factors, ...enriched.baselineFlags])];
    const summary = factors.length
      ? `${type} activity scored ${scored.score}/100: ${factors.join(', ')}.`
      : scored.summary;
    const event = await SecurityEvent.create({ ...enriched, ...scored, factors, summary, submittedBy: req.user._id });
    res.status(201).json(event);
  } catch (error) { next(error); }
});

router.get('/dashboard', async (_req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [eventsToday, openAlerts, activeUsers, activeDevices, bySeverity, byType, highRiskUsers, fileActivity, rawDays, alerts] = await Promise.all([
      SecurityEvent.countDocuments({ createdAt: { $gte: today } }),
      SecurityEvent.countDocuments({ severity: { $in: ['High', 'Critical'] }, status: 'open' }),
      SecurityEvent.distinct('actor').then((actors) => actors.length),
      SecurityEvent.distinct('device').then((devices) => devices.filter((device) => device && device !== 'Not recorded').length),
      SecurityEvent.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      SecurityEvent.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      SecurityEvent.aggregate([{ $group: { _id: '$actor', maxScore: { $max: '$score' } } }, { $sort: { maxScore: -1 } }, { $limit: 5 }, { $project: { _id: 0, actor: '$_id', maxScore: 1 } }]),
      SecurityEvent.aggregate([{ $match: { type: 'file' } }, { $group: { _id: '$actor', files: { $sum: '$fileCount' } } }, { $sort: { files: -1 } }, { $limit: 5 }]),
      SecurityEvent.aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 7 }]),
      SecurityEvent.find({ severity: { $in: ['High', 'Critical'] } }).sort({ createdAt: -1 }).limit(12).lean(),
    ]);
    res.json({ metrics: { eventsToday, openAlerts, activeUsers, activeDevices }, bySeverity, byType, highRiskUsers, fileActivity, threatsByDay: rawDays.length ? rawDays : [{ _id: dayKey(), count: 0 }], alerts });
  } catch (error) { next(error); }
});

router.patch('/events/:id/status', async (req, res, next) => {
  try {
    const { status, responseNote = '' } = req.body;
    if (!['acknowledged', 'resolved'].includes(status)) return res.status(400).json({ message: 'Status must be acknowledged or resolved.' });
    const event = await SecurityEvent.findByIdAndUpdate(req.params.id, { status, responseNote: String(responseNote).slice(0, 500) }, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ message: 'Alert not found.' });
    res.json(event);
  } catch (error) { next(error); }
});

router.post('/demo-seed', async (_req, res, next) => {
  try {
    const demoEvents = [
      { type: 'login', actor: 'j.delacruz', ip: '185.220.101.8', device: 'Unknown Windows device', location: 'Unknown', failedAttempts: 12, isNewDevice: true, isUnknownIp: true, isUnusualTime: true },
      { type: 'file', actor: 'j.delacruz', ip: '185.220.101.8', device: 'Unknown Windows device', location: 'Unknown', fileCount: 145, restrictedFolder: true, isNewDevice: true, isUnknownIp: true },
      { type: 'network', actor: 'system-service', ip: '10.0.0.25', device: 'Test network sensor', location: 'Lab', portScan: true, unusualTraffic: true },
      { type: 'behavior', actor: 'a.santos', ip: '203.0.113.4', device: 'New MacBook', location: 'Quezon City', isNewDevice: true, isUnusualTime: true },
      { type: 'file', actor: 'r.garcia', ip: '10.0.0.18', device: 'Office-PC-18', location: 'Manila', fileCount: 38 },
      { type: 'login', actor: 'r.garcia', ip: '10.0.0.18', device: 'Office-PC-18', location: 'Manila', failedAttempts: 2 },
    ];
    const events = demoEvents.map((item) => ({ ...item, ...scoreSecurityEvent(item), submittedBy: req.user._id }));
    await SecurityEvent.insertMany(events);
    res.status(201).json({ message: `${events.length} simulated events added.`, count: events.length });
  } catch (error) { next(error); }
});

export default router;
