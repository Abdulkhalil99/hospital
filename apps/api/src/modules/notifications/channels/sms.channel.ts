import { logger } from '@/infrastructure/logger/logger';
import { DeliveryResult } from '../notifications.types';

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

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return { success: false, error: 'Twilio SMS provider not configured' };
  }

  try {
    const payload = new URLSearchParams({ To: phone, From: from, Body: message });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload,
      },
    );
    const result = await response.json() as { sid?: string; message?: string };
    if (!response.ok || !result.sid) {
      return { success: false, error: result.message ?? `Twilio returned HTTP ${response.status}` };
    }
    return { success: true, providerMessageId: result.sid };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('SMS delivery failed', { to: phone, error });
    return { success: false, error };
  }
}
