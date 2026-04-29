import { NextIntlClientProvider, useMessages } from 'next-intl';
import { notFound }                             from 'next/navigation';
import { locales, isRTL, type Locale }          from '@/i18n/request';
import type { ReactNode }                        from 'react';

interface Props {
  children:    ReactNode;
  params:      { locale: string };
}

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export default function LocaleLayout({ children, params: { locale } }: Props) {
  if (!locales.includes(locale as Locale)) notFound();

  const messages = useMessages();
  const dir      = isRTL(locale as Locale) ? 'rtl' : 'ltr';

  // Font selection: RTL locales need Noto Naskh Arabic for proper rendering
  const fontClass = dir === 'rtl' ? 'font-arabic' : 'font-sans';

  return (
    <html lang={locale} dir={dir} className={fontClass}>
      <head>
        {dir === 'rtl' && (
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;700&display=swap"
            rel="stylesheet"
          />
        )}
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
