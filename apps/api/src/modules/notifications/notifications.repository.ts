import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import { NotificationPayload, QueueRow } from './notifications.types';

export class NotificationsRepository {
  private db: Pool = getDb();

  async enqueue(data: NotificationPayload & {
    templateId?:     string;
    renderedSubject?: string;
    renderedBody?:   string;
  }): Promise<QueueRow> {
    const { rows } = await this.db.query<QueueRow>(
      `INSERT INTO notifications.notification_queue
         (user_id, recipient_phone, recipient_email,
          event_type, channel_code, locale_code, template_id,
          variables, rendered_subject, rendered_body,
          priority, reference_type, reference_id,
          next_attempt_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       RETURNING *`,
      [
        data.userId          ?? null,
        data.recipientPhone  ?? null,
        data.recipientEmail  ?? null,
        data.eventType,
        data.channelCode,
        data.localeCode      ?? 'en',
        data.templateId      ?? null,
        JSON.stringify(data.variables),
        data.renderedSubject ?? null,
        data.renderedBody    ?? null,
        data.priority        ?? 3,
        data.referenceType   ?? null,
        data.referenceId     ?? null,
      ],
    );
    return rows[0];
  }

  // Claim pending jobs — FOR UPDATE SKIP LOCKED prevents double-processing
  async claimPendingJobs(limit = 20): Promise<QueueRow[]> {
    const { rows } = await this.db.query<QueueRow>(
      `UPDATE notifications.notification_queue
       SET status = 'processing'
       WHERE id IN (
         SELECT id FROM notifications.notification_queue
         WHERE status IN ('pending','failed')
           AND next_attempt_at <= NOW()
           AND attempts < max_attempts
         ORDER BY priority ASC, created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit],
    );
    return rows;
  }

  async markSent(
    id:                string,
    providerMessageId: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE notifications.notification_queue
       SET status = 'sent', sent_at = NOW(), processed_at = NOW(),
           attempts = attempts + 1
       WHERE id = $1`,
      [id],
    );
    await this.db.query(
      `INSERT INTO notifications.notification_log
         (queue_id, user_id, recipient_phone, recipient_email,
          event_type, channel_code, locale_code,
          subject, body, status, provider_message_id, sent_at)
       SELECT id, user_id, recipient_phone, recipient_email,
              event_type, channel_code, locale_code,
              rendered_subject, rendered_body,
              'sent', $2, NOW()
       FROM notifications.notification_queue WHERE id = $1`,
      [id, providerMessageId],
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications.notification_queue
       SET status = CASE
             WHEN attempts + 1 >= max_attempts THEN 'failed'
             ELSE 'pending'
           END,
           attempts        = attempts + 1,
           last_error      = $2,
           next_attempt_at = NOW() + (INTERVAL '1 minute' * POWER(2, attempts)),
           processed_at    = NOW()
       WHERE id = $1`,
      [id, error],
    );
  }

  async getUserPreferences(userId: string): Promise<{
    event_category: string;
    channel_code:   string;
    is_enabled:     boolean;
  }[]> {
    const { rows } = await this.db.query(
      `SELECT event_category, channel_code, is_enabled
       FROM notifications.user_preferences
       WHERE user_id = $1`,
      [userId],
    );
    return rows;
  }

  async getUserContactInfo(userId: string): Promise<{
    email?:    string;
    phone?:    string;
    language:  string;
  }> {
    const { rows } = await this.db.query(
      `SELECT email, phone, preferred_language AS language
       FROM auth.users WHERE id = $1`,
      [userId],
    );
    return rows[0] ?? { language: 'en' };
  }

  async getUserNotifications(userId: string, unreadOnly = false) {
    const { rows } = await this.db.query(
      `SELECT * FROM notifications.notification_log
       WHERE user_id = $1
         AND channel_code = 'inapp'
         AND ($2 = FALSE OR read_at IS NULL)
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, unreadOnly],
    );
    return rows;
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications.notification_log
       SET read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [notificationId, userId],
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications.notification_log
       SET read_at = NOW()
       WHERE user_id = $1 AND channel_code = 'inapp' AND read_at IS NULL`,
      [userId],
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM notifications.notification_log
       WHERE user_id = $1 AND channel_code = 'inapp' AND read_at IS NULL`,
      [userId],
    );
    return Number(rows[0].count);
  }

  async updatePreference(
    userId:        string,
    eventCategory: string,
    channelCode:   string,
    isEnabled:     boolean,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO notifications.user_preferences
         (user_id, event_category, channel_code, is_enabled)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, event_category, channel_code)
       DO UPDATE SET is_enabled = $4, updated_at = NOW()`,
      [userId, eventCategory, channelCode, isEnabled],
    );
  }
}
