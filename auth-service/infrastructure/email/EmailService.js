const nodemailer = require('nodemailer');
const logger     = require('../../logger');

class EmailService {
  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@nexus-hr.com';
    this.appUrl    = process.env.APP_URL    || 'http://localhost:3000';

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
    } else {
      this.transporter = null;
    }
  }

  async send({ to, subject, html }) {
    if (!this.transporter) {
      logger.warn(`[EmailService] No SMTP configured — email NOT sent. To: ${to} | Subject: ${subject}`);
      logger.info(`[EmailService] Body preview: ${html.replace(/<[^>]+>/g, '').slice(0, 200)}`);
      return;
    }
    await this.transporter.sendMail({ from: this.fromEmail, to, subject, html });
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
  }
}

module.exports = new EmailService();
