import { getRequestConfig } from 'next-intl/server';
import { notFound }         from 'next/navigation';
import type { AbstractIntlMessages } from 'next-intl';

export const locales  = ['en', 'fa', 'ps'] as const;
export type  Locale   = typeof locales[number];

export const rtlLocales: Locale[] = ['fa', 'ps'];

export function isRTL(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export default getRequestConfig(async ({ locale }) => {
  if (!locale || !locales.includes(locale as Locale)) notFound();

  // Load all namespace files for this locale
  const namespaces = ['common', 'patients', 'auth', 'emr'];
  const messages: AbstractIntlMessages = {};

  for (const ns of namespaces) {
    try {
      messages[ns] = (await import(`./${locale}/${ns}.json`)).default;
    } catch {
      // Fall back to English if translation file missing
      try {
        messages[ns] = (await import(`./en/${ns}.json`)).default;
      } catch {
        messages[ns] = {};
      }
    }
  }

  return { messages };
});
