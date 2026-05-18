import type { ReactNode } from 'react';
import { LocaleSync } from '@/components/layout/LocaleSync';

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'fa' }, { locale: 'ps' }];
}

export default function LocaleLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params:   { locale: string };
}) {
  return (
    <>
      <LocaleSync locale={locale} />
      {children}
    </>
  );
}
