import { logger } from '@/infrastructure/logger/logger';
import { DeliveryResult } from '../notifications.types';

export async function sendPush(
  deviceToken: string,
  title:       string,
  body:        string,
  data?:       Record<string, string>,
): Promise<DeliveryResult> {
  if (process.env.NODE_ENV === 'development') {
    logger.info('Push notification (dev — not sent)', { deviceToken: deviceToken.slice(0, 10) + '...', title });
    return { success: true, providerMessageId: `push-dev-${Date.now()}` };
  }

  // ── Firebase FCM (uncomment for production) ───────────────
  // const admin = require('firebase-admin');
  // try {
  //   const messageId = await admin.messaging().send({
  //     token: deviceToken,
  //     notification: { title, body },
  //     data: data ?? {},
  //   });
  //   return { success: true, providerMessageId: messageId };
  // } catch (err: unknown) {
  //   const msg = err instanceof Error ? err.message : String(err);
  //   return { success: false, error: msg };
  // }

  return { success: false, error: 'Push provider not configured' };
}
