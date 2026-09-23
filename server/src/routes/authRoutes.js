import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import PendingRegistration from '../models/PendingRegistration.js';
import { requireAuth } from '../middleware/auth.js';
import { clearSessionCookie, setSessionCookie } from '../utils/auth.js';
import { sendOtpEmail, emailConfigured } from '../services/emailService.js';
import { recordAudit } from '../services/auditService.js';
import { validEmail, validPassword, validOtp, passwordHelp } from '../utils/validation.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please wait 15 minutes and try again.' } });
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, isGuest: user.isGuest, preferences: user.preferences, createdAt: user.createdAt });
const codeHash = (code) => crypto.createHash('sha256').update(code).digest('hex');
const makeCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

async function sendCode(user, kind) {
  if (process.env.NODE_ENV === 'production' && !emailConfigured()) throw new Error('Email delivery is not configured.');
  const code = makeCode();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);
  if (kind === 'verify') {
    user.verificationCodeHash = codeHash(code);
    user.verificationCodeExpires = expiry;
  } else {
    user.resetPasswordHash = codeHash(code);
    user.resetPasswordExpires = expiry;
  }
  await user.save();
  await sendOtpEmail({ to: user.email, name: user.name, code, purpose: kind });
  return code;
}
function devCode(body, code) {
  if (process.env.NODE_ENV !== 'production' && !emailConfigured()) body.devOtp = code;
  return body;
}

const LOGIN_LOCK_MS = 5 * 60 * 1000;
function lockResponse(res, until) {
  const seconds = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
  res.set('Retry-After', String(seconds));
  return res.status(429).json({ message: 'Too many incorrect passwords. Try again after 5 minutes.', retryAfter: seconds });
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password;
    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Enter a name between 2 and 80 characters.' });
    if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (!validPassword(password)) return res.status(400).json({ message: passwordHelp });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account already uses that email address.' });
    if (process.env.NODE_ENV === 'production' && !emailConfigured()) return res.status(503).json({ message: 'Email verification is temporarily unavailable.' });
    const code = makeCode();
    const now = new Date();
    const pending = await PendingRegistration.findOne({ email });
    if (pending?.lastSentAt && now - pending.lastSentAt < 60_000) return res.status(429).json({ message: 'Please wait one minute before requesting another code.' });
    await PendingRegistration.findOneAndUpdate({ email }, {
      name, email, passwordHash: await bcrypt.hash(password, 12), codeHash: codeHash(code),
      codeExpiresAt: new Date(now.getTime() + 10 * 60_000), expiresAt: new Date(now.getTime() + 30 * 60_000),
      attempts: 0, lastSentAt: now,
    }, { upsert: true, runValidators: true });
    await sendOtpEmail({ to: email, name, code, purpose: 'verify' });
    return res.status(202).json(devCode({ message: 'Enter the six-digit code sent to your email to finish registration.', email }, code));
  } catch (error) { next(error); }
});

router.post('/verify-email', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    if (!validEmail(email) || !validOtp(code)) return res.status(400).json({ message: 'Enter a valid email and six-digit code.' });
    const pending = await PendingRegistration.findOne({ email }).select('+passwordHash +codeHash');
    let user;
    if (pending) {
      if (pending.attempts >= 5 || pending.codeExpiresAt <= new Date()) return res.status(400).json({ message: 'The code has expired. Request a new one.' });
      if (pending.codeHash !== codeHash(code)) {
        await PendingRegistration.updateOne({ _id: pending._id }, { $inc: { attempts: 1 } });
        return res.status(400).json({ message: 'That verification code is invalid.' });
      }
      user = await User.create({ name: pending.name, email: pending.email, passwordHash: pending.passwordHash, emailVerified: true });
      await PendingRegistration.deleteOne({ _id: pending._id });
      req.user = user;
      await recordAudit(req, 'user.registered', { targetType: 'user', targetId: user._id });
    } else {
      // Complete registrations started before the pending-registration workflow was introduced.
      user = await User.findOne({ email }).select('+verificationCodeHash +verificationCodeExpires');
      if (!user || user.isGuest || user.emailVerified || user.verificationCodeHash !== codeHash(code) || !user.verificationCodeExpires || user.verificationCodeExpires <= new Date()) return res.status(400).json({ message: 'That verification code is invalid or expired.' });
      user.emailVerified = true;
      user.verificationCodeHash = undefined;
      user.verificationCodeExpires = undefined;
      await user.save();
    }
    req.user = user;
    await recordAudit(req, 'user.email_verified', { targetType: 'user', targetId: user._id });
    setSessionCookie(res, user);
    return res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/resend-verification', authLimiter, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' && !emailConfigured()) return res.status(503).json({ message: 'Email verification is temporarily unavailable.' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const body = { message: 'If an unverified account exists, a new code has been sent.' };
    const pending = await PendingRegistration.findOne({ email }).select('+passwordHash +codeHash');
    if (pending) {
      if (Date.now() - pending.lastSentAt.getTime() < 60_000) return res.status(429).json({ message: 'Please wait one minute before requesting another code.' });
      const code = makeCode();
      pending.codeHash = codeHash(code);
      pending.codeExpiresAt = new Date(Date.now() + 10 * 60_000);
      pending.lastSentAt = new Date();
      pending.attempts = 0;
      await pending.save();
      await sendOtpEmail({ to: pending.email, name: pending.name, code, purpose: 'verify' });
      return res.json(devCode(body, code));
    }
    const user = await User.findOne({ email }).select('+verificationCodeHash +verificationCodeExpires');
    if (!user || user.emailVerified || user.isGuest) return res.json(body);
    return res.json(devCode(body, await sendCode(user, 'verify')));
  } catch (error) { next(error); }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!validEmail(email) || password.length > 128) return res.status(400).json({ message: 'Enter a valid email and password.' });
    const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +loginLockedUntil');
    if (user?.loginLockedUntil && user.loginLockedUntil > new Date()) return lockResponse(res, user.loginLockedUntil);
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      if (user?.isActive) {
        const updated = await User.findByIdAndUpdate(user._id, { $inc: { failedLoginAttempts: 1 } }, { new: true }).select('+failedLoginAttempts');
        const attempts = updated.failedLoginAttempts;
        const lockUntil = attempts >= 3 ? new Date(Date.now() + LOGIN_LOCK_MS) : undefined;
        if (lockUntil) await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, loginLockedUntil: lockUntil } });
        if (lockUntil) return lockResponse(res, lockUntil);
        return res.status(401).json({ message: `Incorrect email or password. ${3 - attempts} attempt${attempts === 2 ? '' : 's'} remaining before a 5-minute lock.` });
      }
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }
    if (user.failedLoginAttempts || user.loginLockedUntil) await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0 }, $unset: { loginLockedUntil: 1 } });
    if (!user.emailVerified && !user.isGuest) return res.status(403).json({ message: 'Verify your email before signing in.', needsVerification: true, email: user.email });
    setSessionCookie(res, user);
    req.user = user;
    await recordAudit(req, 'user.logged_in', { targetType: 'user', targetId: user._id });
    return res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/guest', authLimiter, async (req, res, next) => {
  try {
    const suffix = crypto.randomBytes(12).toString('hex');
    const user = await User.create({ name: 'Guest', email: 'guest-' + suffix + '@guest.scamscan.local', passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), isGuest: true, emailVerified: true, preferences: { emailNotifications: false, scanTips: true } });
    setSessionCookie(res, user);
    req.user = user;
    await recordAudit(req, 'guest.started', { targetType: 'user', targetId: user._id });
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/logout', requireAuth, async (req, res) => {
  await recordAudit(req, 'user.logged_out', { targetType: 'user', targetId: req.user._id });
  clearSessionCookie(res);
  res.status(204).end();
});
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    if (req.user.isGuest) return res.status(403).json({ message: 'Guest accounts cannot edit a profile.' });
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Enter a name between 2 and 80 characters.' });
    req.user.name = name;
    await req.user.save();
    await recordAudit(req, 'user.profile_updated', { targetType: 'user', targetId: req.user._id });
    return res.json({ user: publicUser(req.user) });
  } catch (error) { next(error); }
});

router.patch('/preferences', requireAuth, async (req, res, next) => {
  try {
    if (req.user.isGuest) return res.status(403).json({ message: 'Guest accounts cannot edit settings.' });
    const preferences = req.body.preferences || {};
    if (typeof preferences.emailNotifications !== 'boolean' || typeof preferences.scanTips !== 'boolean') return res.status(400).json({ message: 'Preferences must be true or false.' });
    req.user.preferences = preferences;
    await req.user.save();
    await recordAudit(req, 'user.preferences_updated', { targetType: 'user', targetId: req.user._id });
    return res.json({ user: publicUser(req.user) });
  } catch (error) { next(error); }
});

router.post('/change-password', requireAuth, authLimiter, async (req, res, next) => {
  try {
    if (req.user.isGuest) return res.status(403).json({ message: 'Guest accounts cannot change passwords.' });
    const user = await User.findById(req.user._id).select('+passwordHash');
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(400).json({ message: 'Your current password is incorrect.' });
    if (!validPassword(req.body.newPassword)) return res.status(400).json({ message: passwordHelp });
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await user.save();
    await recordAudit(req, 'user.password_changed', { targetType: 'user', targetId: user._id });
    clearSessionCookie(res);
    return res.json({ message: 'Password changed. Please sign in again.' });
  } catch (error) { next(error); }
});

router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' && !emailConfigured()) return res.status(503).json({ message: 'Password reset email is temporarily unavailable.' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email }).select('+resetPasswordHash +resetPasswordExpires');
    const body = { message: 'If that address belongs to a verified account, a six-digit reset code has been sent.' };
    if (!user || user.isGuest || !user.emailVerified) return res.json(body);
    const code = await sendCode(user, 'reset');
    req.user = user;
    await recordAudit(req, 'user.password_reset_requested', { targetType: 'user', targetId: user._id });
    return res.json(devCode(body, code));
  } catch (error) { next(error); }
});

router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const password = req.body.password;
    if (!validPassword(password)) return res.status(400).json({ message: passwordHelp });
    const user = await User.findOne({ email }).select('+resetPasswordHash +resetPasswordExpires +passwordHash');
    if (!user || user.resetPasswordHash !== codeHash(code) || !user.resetPasswordExpires || user.resetPasswordExpires <= new Date()) return res.status(400).json({ message: 'This reset code is invalid or expired.' });
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordHash = undefined;
    user.resetPasswordExpires = undefined;
    user.failedLoginAttempts = 0;
    user.loginLockedUntil = undefined;
    await user.save();
    req.user = user;
    await recordAudit(req, 'user.password_reset_completed', { targetType: 'user', targetId: user._id });
    clearSessionCookie(res);
    return res.json({ message: 'Your password was updated. You can now sign in.' });
  } catch (error) { next(error); }
});

export default router;
