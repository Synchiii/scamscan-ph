import nodemailer from 'nodemailer';

export function emailConfigured() { return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS); }
const configured = emailConfigured;

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!configured()) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'ScamScan <no-reply@example.com>',
    to,
    subject: 'Reset your ScamScan password',
    text: `Hello ${name},\n\nReset your password using this link within one hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
  return true;
}

export async function sendOtpEmail({ to, name, code, purpose }) {
  if (!configured()) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const title = purpose === 'verify' ? 'Verify your ScamScan email' : 'Reset your ScamScan password';
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'ScamScan <no-reply@example.com>',
    to,
    subject: title,
    text: 'Hello ' + name + ',\n\nYour ScamScan ' + (purpose === 'verify' ? 'email verification' : 'password reset') + ' code is: ' + code + '\n\nIt expires in 10 minutes. Never share this code with anyone.',
  });
  return true;
}

export async function sendSupportNotification({ to, senderName, senderEmail, subject, message }) {
  if (!configured()) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'ScamScan <no-reply@example.com>',
    to,
    subject: '[ScamScan Help] ' + subject,
    text: 'From: ' + senderName + ' <' + senderEmail + '>\n\n' + message,
  });
  return true;
}

export async function sendSupportReplyEmail({ to, name, subject, reply }) {
  if (!emailConfigured()) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'ScamScan <no-reply@example.com>',
    to,
    subject: 'Re: ScamScan help request — ' + subject,
    text: 'Hello ' + name + ',\n\n' + reply + '\n\nYou can also read this reply in your ScamScan Help Center.',
  });
  return true;
}
