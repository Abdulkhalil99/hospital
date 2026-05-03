import { DeliveryResult } from '../notifications.types';
import { logger } from '@/infrastructure/logger/logger';

export async function sendInApp(
  userId:  string,
  subject: string | null,
  body:    string,
  meta?:   Record<string, unknown>,
): Promise<DeliveryResult> {
  try {
    // Import lazily to avoid circular dep at startup
    const { getIO } = await import('@/infrastructure/websocket/ws.server');
    const io = getIO();

    // Each user has their own private room: user:{userId}
    io.to(`user:${userId}`).emit('notification:new', {
      id:        `notif-${Date.now()}`,
      subject,
      body,
      meta,
      receivedAt: new Date().toISOString(),
      read:       false,
    });

    logger.debug('In-app notification sent', { userId, subject });
    return { success: true, providerMessageId: `inapp-${Date.now()}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('In-app notification failed (WebSocket not available)', { userId, error: msg });
    return { success: false, error: msg };
  }
}
