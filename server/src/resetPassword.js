import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import User from './models/User.js';
import { validEmail, validPassword, passwordHelp } from './utils/validation.js';

const prompt = createInterface({ input, output });
try {
  const email = String(await prompt.question('Account email: ')).trim().toLowerCase();
  const password = String(await prompt.question('New password (8–128 characters, no spaces): '));
  if (!validEmail(email) || !validPassword(password)) throw new Error('Enter a valid email. Password: ' + passwordHelp);
  await connectDatabase(process.env.MONGODB_URI);
  const user = await User.findOne({ email, isGuest: { $ne: true } }).select('+passwordHash');
  if (!user) throw new Error('No registered account was found for that email.');
  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetPasswordHash = undefined;
  user.resetPasswordExpires = undefined;
  user.failedLoginAttempts = 0;
  user.loginLockedUntil = undefined;
  await user.save();
  console.log('Password updated for ' + user.email + '. Role unchanged: ' + user.role + '.');
} catch (error) {
  console.error('Password was not changed: ' + error.message);
  process.exitCode = 1;
} finally {
  prompt.close();
  await mongoose.disconnect();
}
