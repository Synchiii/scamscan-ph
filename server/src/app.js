import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import scamRoutes from './routes/scamRoutes.js';
import threatRoutes from './routes/threatRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import managementRoutes from './routes/managementRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { maintenanceGuard } from './middleware/maintenance.js';

const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
// Render adds X-Forwarded-For before requests reach this service.
app.set('trust proxy', 1);
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'DENY');
  next();
});
app.use('/api', rateLimit({ windowMs: 15 * 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many requests. Please try again shortly.' } }));
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && origin !== allowedOrigin) return res.status(403).json({ message: 'Request origin is not allowed.' });
  next();
});
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/api', maintenanceGuard);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'scamscan-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/scam', scamRoutes);
app.use('/api/threats', threatRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/chat', chatRoutes);
app.use((error, _req, res, _next) => {
  if (res.headersSent) return res.destroy();
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'The upload is too large. Videos are limited to 25 MB.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'The submitted data is not valid.' });
  if ([400, 413, 415, 503].includes(error.status)) return res.status(error.status).json({ message: error.message });
  if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid record identifier.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: 'Please check the submitted fields.' });
  if (error.code === 11000) return res.status(409).json({ message: 'That account or record already exists.' });
  console.error(error);
  res.status(500).json({ message: 'Unexpected server error.' });
});

export default app;
