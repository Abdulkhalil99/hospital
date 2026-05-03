import { getDb } from '@/infrastructure/database/db.client';
import { TemplateRow } from './notifications.types';

// In-memory cache keyed by event_type:channel:locale
const cache = new Map<string, TemplateRow>();

export async function loadTemplateCache(): Promise<void> {
  const db = getDb();
  const { rows } = await db.query<TemplateRow>(
    `SELECT * FROM notifications.notification_templates WHERE is_active = TRUE`,
  );
  rows.forEach(t => {
    cache.set(`${t.event_type}:${t.channel_code}:${t.locale_code}`, t);
  });
}

export function getTemplate(
  eventType:   string,
  channelCode: string,
  localeCode:  string,
): TemplateRow | null {
  // Try exact match first, then fall back to English
  return (
    cache.get(`${eventType}:${channelCode}:${localeCode}`) ??
    cache.get(`${eventType}:${channelCode}:en`) ??
    null
  );
}

// Replace {{variable_name}} with actual values
export function renderTemplate(
  template:  string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

export function renderNotification(
  eventType:   string,
  channelCode: string,
  localeCode:  string,
  variables:   Record<string, string>,
): { subject: string | null; body: string } | null {
  const template = getTemplate(eventType, channelCode, localeCode);
  if (!template) return null;

  return {
    subject: template.subject ? renderTemplate(template.subject, variables) : null,
    body:    renderTemplate(template.body, variables),
  };
}
