'use client';
import { useEffect } from 'react';
import { isRTL } from '@/lib/i18n';

export function LocaleSync({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRTL(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  return null;
}
