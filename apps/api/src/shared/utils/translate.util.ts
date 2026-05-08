// Simple in-memory translation store
// Loaded at startup from the i18n module
const translations: Record<string, Record<string, string>> = {
  en: {}, fa: {}, ps: {},
};

export function loadTranslations(locale: string, data: Record<string, string>): void {
  translations[locale] = { ...translations[locale], ...data };
}

export function t(key: string, locale = 'en', vars?: Record<string, string>): string {
  const msg = translations[locale]?.[key]
    ?? translations.en?.[key]
    ?? key;

  if (!vars) return msg;

  return msg.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
