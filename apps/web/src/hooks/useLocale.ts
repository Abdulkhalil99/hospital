'use client';
import { useLocale as useNextIntlLocale } from 'next-intl';
import type { Locale }                                     from '@/i18n/request';
import { locales }                                         from '@/i18n/request';

export const RTL_LOCALES: Locale[] = ['fa', 'ps'];

export function useLocale() {
  const locale   = useNextIntlLocale() as Locale;

  const isRTL  = RTL_LOCALES.includes(locale);
  const dir    = isRTL ? 'rtl' : 'ltr';

  function switchLocale(newLocale: Locale) {
    if (typeof window === 'undefined') return;

    const { pathname, search, hash } = window.location;
    const parts = pathname.split('/');

    if (locales.includes(parts[1] as Locale)) {
      parts[1] = newLocale;
    } else {
      parts.splice(1, 0, newLocale);
    }

    window.location.assign(`${parts.join('/')}${search}${hash}`);
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
