import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDatabase } from './config/db.js';
import User from './models/User.js';
import { validPassword, passwordHelp } from './utils/validation.js';
import { normalizePersonName, validPersonName, personNameHelp } from './utils/personName.js';

const name = normalizePersonName(process.env.ADMIN_NAME);
const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
try {
  if (!validPersonName(name)) throw new Error('ADMIN_NAME: ' + personNameHelp);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validPassword(password)) throw new Error('Set ADMIN_EMAIL in server/.env. ADMIN_PASSWORD: ' + passwordHelp);
  await connectDatabase(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await User.findOneAndUpdate({ email }, { name, email, passwordHash, role: 'admin', emailVerified: true, isActive: true }, { new: true, upsert: true, runValidators: true });
  console.log(`Administrator ready: ${admin.email}`);
  process.exit(0);
} catch (error) {
  console.error(`Could not create administrator: ${error.message}`);
  process.exit(1);
}
