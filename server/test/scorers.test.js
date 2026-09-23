import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreScamMessage, detectLanguage } from '../src/services/scamScorer.js';
import { scoreSecurityEvent } from '../src/services/threatScorer.js';
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
  assert.ok(!validPassword('Study 123'));
  assert.ok(!validPassword('Short1'));
  assert.ok(!validPassword('password'));
});
