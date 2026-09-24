function emailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
}

function sender() {
  const value = process.env.EMAIL_FROM.trim();
  const match = value.match(/^(?:\s*(.*?)\s*<)?([^<>@\s]+@[^<>@\s]+)>?\s*$/);
  return {
    email: match ? match[2] : value,
    name: match?.[1]?.trim() || 'SCAMSCAN PH',
  };
}

async function sendEmail({ to, subject, text }) {
  if (!emailConfigured()) return false;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Brevo email request failed (${response.status}): ${details}`);
  }

  return true;
}

export { emailConfigured };

export function sendPasswordResetEmail({ to, name, resetUrl }) {
  return sendEmail({
    to,
    subject: 'Reset your ScamScan password',
    text: `Hello ${name},\n\nReset your password using this link within one hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
}

export function sendOtpEmail({ to, name, code, purpose }) {
  const isVerification = purpose === 'verify';
  return sendEmail({
    to,
    subject: isVerification ? 'Verify your ScamScan email' : 'Reset your ScamScan password',
    text: `Hello ${name},\n\nYour ScamScan ${isVerification ? 'email verification' : 'password reset'} code is: ${code}\n\nIt expires in 10 minutes. Never share this code with anyone.`,
  });
}

export function sendSupportNotification({ to, senderName, senderEmail, subject, message }) {
  return sendEmail({
    to,
    subject: `[ScamScan Help] ${subject}`,
    text: `From: ${senderName} <${senderEmail}>\n\n${message}`,
  });
}

export function sendSupportReplyEmail({ to, name, subject, reply }) {
  return sendEmail({
    to,
    subject: `Re: ScamScan help request — ${subject}`,
    text: `Hello ${name},\n\n${reply}\n\nYou can also read this reply in your ScamScan Help Center.`,
  });
}
