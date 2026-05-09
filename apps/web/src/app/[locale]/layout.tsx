import type { ReactNode } from 'react';

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
  return <>{children}</>;
}
