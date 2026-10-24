import nodemailer from 'nodemailer';
import { logger } from '@/infrastructure/logger/logger';
import { DeliveryResult } from '../notifications.types';

// In development: emails go to MailHog at http://localhost:8025
// In production: use SendGrid, SES, or SMTP

export async function sendEmail(
  to:      string,
  subject: string,
  body:    string,
): Promise<DeliveryResult> {
  const isProduction = process.env.NODE_ENV === 'production';
  const host = process.env.SMTP_HOST ?? (isProduction ? undefined : 'localhost');
  const port = Number(process.env.SMTP_PORT ?? (isProduction ? 587 : 1025));

  if (!host || !Number.isInteger(port) || port <= 0) {
    return { success: false, error: 'SMTP provider not configured' };
  }

  try {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
    const escapedBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@medicore.local',
      to,
      subject,
      text: body,
      html: `<div style="font-family:sans-serif;max-width:600px">${escapedBody}</div>`,
    });
    logger.info('Email sent', { to, messageId: info.messageId });
    return { success: true, providerMessageId: info.messageId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Email delivery failed', { to, error: message });
    return { success: false, error: message };
  }
}
