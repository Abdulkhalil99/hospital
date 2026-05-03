import { NotificationsRepository } from './notifications.repository';
import { NotificationPayload }     from './notifications.types';
import { renderNotification }      from './template.engine';
import { logger }                  from '@/infrastructure/logger/logger';

export class NotificationsService {
  private repo = new NotificationsRepository();

  // ── Send a notification to a specific user ────────────────
  // Respects their channel preferences and language
  async sendToUser(
    userId:        string,
    eventType:     string,
    variables:     Record<string, string>,
    options?: {
      priority?:      1 | 2 | 3 | 4;
      referenceType?: string;
      referenceId?:   string;
      channels?:      string[];     // override — send only on these channels
    },
  ): Promise<void> {
    const [contactInfo, preferences] = await Promise.all([
      this.repo.getUserContactInfo(userId),
      this.repo.getUserPreferences(userId),
    ]);

    const locale = (contactInfo.language ?? 'en') as 'en' | 'fa' | 'ps';
    const category = this.getCategory(eventType);

    const channels = options?.channels ?? ['sms', 'email', 'inapp'];

    for (const channel of channels) {
      // Check user preference for this category + channel
      const pref = preferences.find(
        p => p.event_category === category && p.channel_code === channel,
      );
      if (pref && !pref.is_enabled) continue;

      // Render template
      const rendered = renderNotification(eventType, channel, locale, variables);
      if (!rendered) {
        logger.debug('No template found', { eventType, channel, locale });
        continue;
      }

      // Determine recipient contact
      let recipientPhone: string | undefined;
      let recipientEmail: string | undefined;

      if (channel === 'sms')   recipientPhone = contactInfo.phone;
      if (channel === 'email') recipientEmail = contactInfo.email;
      if ((channel === 'sms' && !recipientPhone) ||
          (channel === 'email' && !recipientEmail)) continue;

      await this.repo.enqueue({
        userId,
        recipientPhone,
        recipientEmail,
        eventType,
        channelCode:     channel as 'sms' | 'email' | 'inapp' | 'push',
        localeCode:      locale,
        variables,
        renderedSubject: rendered.subject ?? undefined,
        renderedBody:    rendered.body,
        priority:        options?.priority ?? 3,
        referenceType:   options?.referenceType,
        referenceId:     options?.referenceId,
      });
    }
  }

  // ── Send to a specific phone/email (no user account needed) ─
  async sendDirect(payload: NotificationPayload): Promise<void> {
    const rendered = renderNotification(
      payload.eventType,
      payload.channelCode,
      payload.localeCode ?? 'en',
      payload.variables,
    );

    await this.repo.enqueue({
      ...payload,
      renderedSubject: rendered?.subject ?? undefined,
      renderedBody:    rendered?.body    ?? payload.variables.body ?? '',
    });
  }

  // ── User notification inbox ───────────────────────────────
  async getNotifications(userId: string, unreadOnly = false) {
    return this.repo.getUserNotifications(userId, unreadOnly);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.getUnreadCount(userId);
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.repo.markRead(notificationId, userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
  }

  // ── Preferences ───────────────────────────────────────────
  async updatePreference(
    userId:        string,
    eventCategory: string,
    channelCode:   string,
    isEnabled:     boolean,
  ): Promise<void> {
    await this.repo.updatePreference(userId, eventCategory, channelCode, isEnabled);
  }

  async getPreferences(userId: string) {
    return this.repo.getUserPreferences(userId);
  }

  // ── Map event type to category ────────────────────────────
  private getCategory(eventType: string): string {
    if (eventType.startsWith('appointment'))  return 'appointments';
    if (eventType.startsWith('lab_result'))   return 'lab_results';
    if (eventType.startsWith('queue'))        return 'appointments';
    if (eventType.startsWith('payment') ||
        eventType.startsWith('invoice'))      return 'billing';
    if (eventType.startsWith('emergency'))    return 'system';
    return 'system';
  }
}
