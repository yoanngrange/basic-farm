const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("./logger");

let transporter = null;
function getTransporter() {
  if (!env.smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }
  return transporter;
}

/**
 * Fire-and-forget notification email. Never throws — a broken/unset SMTP
 * config, or Clever Cloud's Mailgun/SendGrid add-on being briefly down,
 * must never fail the candidate's contact submission. Logs instead, so
 * the failure is still visible in the structured logs.
 */
async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    logger.warn({ to, subject }, "SMTP not configured — skipping email notification");
    return { skipped: true };
  }
  try {
    await t.sendMail({ from: env.emailFrom, to, subject, text });
    return { skipped: false };
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send notification email");
    return { skipped: true, error: true };
  }
}

module.exports = { sendMail };
