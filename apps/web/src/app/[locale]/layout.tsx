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
  const isRTL = locale === 'fa' || locale === 'ps';
  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'}>
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
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: ${isRTL ? "'Noto Naskh Arabic', Arial" : 'Inter, Arial'}, sans-serif;
            background: #f5f6fa;
            color: #1a1a2e;
          }
          a { text-decoration: none; color: inherit; }
          button { cursor: pointer; font-family: inherit; }
          input, select, textarea {
            font-family: inherit;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 14px;
            outline: none;
            width: 100%;
          }
          input:focus, select:focus, textarea:focus { border-color: #185FA5; }
          button {
            background: #185FA5;
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 8px 18px;
            font-size: 14px;
          }
          button:hover { background: #0F4A8A; }
          button.secondary {
            background: #f0f0f0;
            color: #333;
          }
          button.secondary:hover { background: #e0e0e0; }
          button.danger { background: #E24B4A; }
          button.danger:hover { background: #C73938; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
