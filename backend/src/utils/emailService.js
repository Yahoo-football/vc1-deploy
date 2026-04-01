let nodemailer = null;

// Get nodemailer for the current flow.
const getNodemailer = () => {
  if (nodemailer) return nodemailer;

  try {
    nodemailer = require('nodemailer');
    return nodemailer;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[email] nodemailer is not installed, skipping email transport setup');
    }
    return null;
  }
};

// Support has smtp config for this module.
const hasSmtpConfig = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
};

// Get transporter for the current flow.
const getTransporter = () => {
  if (!hasSmtpConfig()) return null;

  const mailer = getNodemailer();
  if (!mailer) return null;

  return mailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Support send email for this module.
const sendEmail = async ({ to, subject, text, html }) => {
  if (!to) return;

  const transporter = getTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[email] SMTP not configured, skipping send:', { to, subject });
    }
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });
};

module.exports = {
  hasSmtpConfig,
  sendEmail
};

