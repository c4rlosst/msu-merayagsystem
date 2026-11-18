import nodemailer from 'nodemailer';

// Outgoing email goes through any SMTP service (Brevo, Gmail, and so on). Until the MAIL_* settings exist
// the site works as before and simply doesn't send email.
export function mailConfigured() {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASSWORD && process.env.MAIL_FROM);
}

let transport;
function connection() {
  transport ??= nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000
  });
  return transport;
}

/** Sends one email. Never throws: the result says whether it went out, so a mail problem can't undo an action. */
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) return { ok: false, reason: 'off' };
  try {
    await connection().sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
