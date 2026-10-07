import { Router } from 'express';
import SiteSettings, { DEFAULT_MAINTENANCE_MESSAGE } from '../models/SiteSettings.js';
import Content from '../models/Content.js';

const router = Router();
router.get('/status', async (_req, res, next) => {
  try {
    const settings = await SiteSettings.findOne({ key: 'site' }).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ maintenanceEnabled: settings?.maintenanceEnabled || false, maintenanceMessage: settings?.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE });
  } catch (error) { next(error); }
});
router.get('/content', async (_req, res, next) => {
  try { res.json({ contents: await Content.find({ status: 'published' }).sort({ updatedAt: -1 }).limit(50).lean() }); }
  catch (error) { next(error); }
});
export default router;
