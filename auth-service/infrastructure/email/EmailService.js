const nodemailer = require('nodemailer');
const logger     = require('../../logger');

class EmailService {
  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@nexus-hr.com';
    this.appUrl    = process.env.APP_URL    || 'http://localhost';
    this._ready    = null; // resolved once on first use
  }

  // Lazy async init — runs once, result cached in _ready
  _init() {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      if (process.env.SMTP_HOST) {
        this.transporter = nodemailer.createTransport({
          host:   process.env.SMTP_HOST,
          port:   parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        this.useEthereal = false;
        logger.info('[EmailService] Using real SMTP provider.');
      } else if (process.env.NODE_ENV === 'test') {
        // No-op in Jest — avoids network calls during tests
        this.transporter = null;
        this.useEthereal = false;
      } else {
        // Dev / demo — auto-create a free Ethereal test inbox
        const account = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host:   'smtp.ethereal.email',
          port:   587,
          secure: false,
          auth: { user: account.user, pass: account.pass },
        });
        this.useEthereal = true;
        logger.info(`[EmailService] No SMTP configured — using Ethereal test inbox (${account.user}). Emails are preview-only; check logs for preview URLs.`);
      }
    })();
    return this._ready;
  }

  async send({ to, subject, html }) {
    await this._init();

    if (!this.transporter) {
      logger.warn(`[EmailService] Email suppressed (test mode). To: ${to} | Subject: ${subject}`);
      return null;
    }

    const info = await this.transporter.sendMail({ from: this.fromEmail, to, subject, html });

    if (this.useEthereal) {
      logger.info(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  }

  async sendActivationEmail(user, token) {
    const link = `${this.appUrl}/activate/${token}`;
    await this.send({
      to:      user.email,
      subject: 'Activate your Nexus HR account',
      html: `
        <h2>Welcome to Nexus HR, ${user.username}!</h2>
        <p>Please activate your account by clicking the link below:</p>
        <p><a href="${link}">${link}</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    });
    // Log the direct link so devs can click it without opening the Ethereal inbox
    if (this.useEthereal) {
      logger.info(`[EmailService] Direct activation link for ${user.email}: ${link}`);
    }
  }

  async sendPasswordResetEmail(user, token) {
    const link = `${this.appUrl}/reset-password/${token}`;
    await this.send({
      to:      user.email,
      subject: 'Reset your Nexus HR password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <p><a href="${link}">${link}</a></p>
        <p>This link expires in 1 hour. If you did not request this, please ignore this email.</p>
      `,
    });
    if (this.useEthereal) {
      logger.info(`[EmailService] Direct reset link for ${user.email}: ${link}`);
    }
  }
}

module.exports = new EmailService();
