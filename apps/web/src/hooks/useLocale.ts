'use client';
import { useLocale as useNextIntlLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname }                          from '@/i18n/navigation';
import type { Locale }                                     from '@/i18n/request';

export const RTL_LOCALES: Locale[] = ['fa', 'ps'];

export function useLocale() {
  const locale   = useNextIntlLocale() as Locale;
  const router   = useRouter();
  const pathname = usePathname();

  const isRTL  = RTL_LOCALES.includes(locale);
  const dir    = isRTL ? 'rtl' : 'ltr';

  function switchLocale(newLocale: Locale) {
    router.replace(pathname, { locale: newLocale });
  }

  return { locale, isRTL, dir, switchLocale };
}

// Convenience: get RTL-aware Tailwind class
// Usage: <div className={rtl('mr-4', 'ml-4')}>
export function useRTLClass() {
  const { isRTL } = useLocale();
  return function rtl(ltrClass: string, rtlClass: string): string {
    return isRTL ? rtlClass : ltrClass;
  };
}
