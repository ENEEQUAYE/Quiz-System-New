const nodemailer = require('nodemailer');

let transporter;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = getRequiredEnv('SMTP_HOST');
  const port = Number(process.env.SMTP_PORT || 587);
  const user = getRequiredEnv('SMTP_USER');
  const pass = getRequiredEnv('SMTP_PASS');
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!to || !subject || (!text && !html)) {
    throw new Error('sendMail requires to, subject, and text or html content');
  }

  const info = await getTransporter().sendMail({
    from,
    to,
    subject,
    text,
    html
  });

  console.log(`Email sent to ${to}. Message ID: ${info.messageId}`);
  return info;
}

module.exports = { sendMail };
