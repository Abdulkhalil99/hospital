import { logger } from '@/infrastructure/logger/logger';
import { DeliveryResult } from '../notifications.types';

// In development: emails go to MailHog at http://localhost:8025
// In production: use SendGrid, SES, or SMTP

export async function sendEmail(
  to:      string,
  subject: string,
  body:    string,
): Promise<DeliveryResult> {
  if (process.env.NODE_ENV === 'development') {
    // Send to MailHog via SMTP
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: 1025,
        secure: false,
      });
      const info = await transporter.sendMail({
        from:    '"MediCore" <noreply@medicore.local>',
        to,
        subject,
        text:    body,
        html:    `<div style="font-family:sans-serif;max-width:600px">${body.replace(/\n/g, '<br>')}</div>`,
      });
      logger.info('Email sent to MailHog', { to, messageId: info.messageId });
      return { success: true, providerMessageId: info.messageId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('MailHog not available — email logged only', { to, subject });
      logger.info('Email content', { to, subject, body: body.slice(0, 200) });
      return { success: true, providerMessageId: `logged-${Date.now()}` };
    }
  }

  // ── SendGrid (uncomment for production) ───────────────────
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // try {
  //   const [response] = await sgMail.send({ to, from: 'noreply@medicore.af', subject, text: body });
  //   return { success: true, providerMessageId: response.headers['x-message-id'] };
  // } catch (err: unknown) {
  //   const msg = err instanceof Error ? err.message : String(err);
  //   return { success: false, error: msg };
  // }

  logger.warn('Email channel not configured for production');
  return { success: false, error: 'Email provider not configured' };
}
