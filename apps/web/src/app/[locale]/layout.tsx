import type { ReactNode } from 'react';
import '../globals.css';

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
  const isRTL = locale === 'fa' || locale === 'ps';

  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>MediCore HMS</title>
        {isRTL && (
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;700&display=swap"
            rel="stylesheet"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
