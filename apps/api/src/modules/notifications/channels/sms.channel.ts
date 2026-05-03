import { logger } from '@/infrastructure/logger/logger';
import { DeliveryResult } from '../notifications.types';

// In production: replace this with Twilio, local SMS gateway, or KaveNegar
// npm install twilio   ← then uncomment the Twilio block below

export async function sendSms(
  phone:   string,
  message: string,
): Promise<DeliveryResult> {
  // ── Development mode: log only ────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    logger.info('SMS (dev — not sent)', {
      to:      phone,
      message: message.slice(0, 80) + (message.length > 80 ? '...' : ''),
    });
    return { success: true, providerMessageId: `dev-${Date.now()}` };
  }

  // ── Twilio (uncomment for production) ─────────────────────
  // const twilio = require('twilio')(
  //   process.env.TWILIO_ACCOUNT_SID,
  //   process.env.TWILIO_AUTH_TOKEN,
  // );
  // try {
  //   const msg = await twilio.messages.create({
  //     body: message,
  //     from: process.env.TWILIO_PHONE_NUMBER,
  //     to:   phone,
  //   });
  //   return { success: true, providerMessageId: msg.sid };
  // } catch (err: unknown) {
  //   const message = err instanceof Error ? err.message : String(err);
  //   return { success: false, error: message };
  // }

  // ── Placeholder for any HTTP SMS provider ─────────────────
  // const res = await fetch('https://your-sms-api.com/send', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${process.env.SMS_API_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ to: phone, text: message }),
  // });
  // const data = await res.json();
  // return { success: res.ok, providerMessageId: data.messageId, error: data.error };

  logger.warn('SMS channel not configured — message not sent', { to: phone });
  return { success: false, error: 'SMS provider not configured' };
}
