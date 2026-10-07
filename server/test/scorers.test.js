import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { scoreScamMessage, detectLanguage } from '../src/services/scamScorer.js';
import { scoreSecurityEvent } from '../src/services/threatScorer.js';
import { getSessionDurationMs, signSession } from '../src/utils/auth.js';
import { validEmail, validOtp, validPassword } from '../src/utils/validation.js';

test('scam scorer flags OTP, prize, urgency and URL', () => {
  const result = scoreScamMessage('Congratulations! Nanalo ka ng ₱50,000! Send your OTP now: https://bit.ly/claim');
  assert.equal(result.level, 'Scam');
  assert.ok(result.score >= 80);
  assert.ok(result.flags.includes('Request to disclose an OTP or PIN'));
});

test('language detector recognizes Taglish', () => {
  assert.equal(detectLanguage('Your GCash account ay ma-block today'), 'Taglish');
});

test('detector rates a suspicious account URL above a routine HTTPS link', () => {
  const risky = scoreScamMessage('https://gcas-verify-claim.ph/login');
  const routine = scoreScamMessage('https://gcash.com/login');
  assert.ok(risky.score >= 60);
  assert.ok(risky.score > routine.score);
  assert.equal(risky.level, 'High');
  assert.ok(risky.flags.includes('Unverified brand-like domain'));
});

test('ordinary security guidance does not become an OTP disclosure request', () => {
  const result = scoreScamMessage('Please do not share your OTP with anyone.');
  assert.ok(!result.flags.includes('Request to disclose an OTP or PIN'));
});

test('threat scorer creates a critical combined-login-and-file alert', () => {
  const result = scoreSecurityEvent({ type: 'login', failedAttempts: 10, isNewDevice: true, isUnknownIp: true, isUnusualTime: true, fileCount: 150, restrictedFolder: true });
  assert.equal(result.severity, 'Critical');
  assert.equal(result.score, 100);
});

test('account validation enforces email, six-digit OTP and eight-character no-space passwords', () => {
  assert.ok(validEmail('student@example.com'));
  assert.ok(!validEmail('student @example.com'));
  assert.ok(validOtp('042019'));
  assert.ok(!validOtp('42'));
  assert.ok(validPassword('Study123'));
  assert.ok(validPassword('password'));
  assert.ok(!validPassword('Study 123'));
  assert.ok(!validPassword('Short1'));
});

test('session duration defaults to 30 minutes and rejects longer or unsafe values', () => {
  const original = process.env.SESSION_TTL_HOURS;
  try {
    delete process.env.SESSION_TTL_HOURS;
    assert.equal(getSessionDurationMs(), 30 * 60 * 1000);
    for (const value of ['2', '999', '0', '-1', 'invalid']) {
      process.env.SESSION_TTL_HOURS = value;
      assert.equal(getSessionDurationMs(), 30 * 60 * 1000);
    }
  } finally {
    if (original === undefined) delete process.env.SESSION_TTL_HOURS;
    else process.env.SESSION_TTL_HOURS = original;
  }
});

test('JWT expiry follows the configured session duration', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalHours = process.env.SESSION_TTL_HOURS;
  try {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-session-tests';
    process.env.SESSION_TTL_HOURS = '0.5';
    const token = signSession({ _id: { toString: () => 'user-123' }, role: 'user' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(payload.exp - payload.iat, 30 * 60);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalHours === undefined) delete process.env.SESSION_TTL_HOURS;
    else process.env.SESSION_TTL_HOURS = originalHours;
  }
});
