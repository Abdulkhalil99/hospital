'use client';
import { usePathname } from 'next/navigation';
import { useT, isRTL } from '@/lib/i18n';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const pathname = usePathname();
  const locale = ['en', 'fa', 'ps'].includes(pathname.split('/')[1] ?? '')
    ? pathname.split('/')[1]
    : 'en';
  const t = useT(locale);
  const rtl = isRTL(locale);

  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          direction: rtl ? 'rtl' : 'ltr',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 620,
            background: '#fff',
            borderRadius: 18,
            padding: 30,
            boxShadow: '0 28px 70px rgba(15, 23, 42, 0.35)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 10 }}>
            {t('Critical application error')}
          </div>
          <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: '0 0 12px', color: '#0f172a' }}>
            {t('MediCore could not recover from this render.')}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#475569', margin: '0 0 18px' }}>
            {t('This is the global error boundary for the Next.js app router. It prevents broken refresh loops during development and gives the app a stable fallback UI.')}
          </p>

          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '12px 14px',
              color: '#334155',
              marginBottom: 18,
              wordBreak: 'break-word',
            }}
          >
            {error.message ? t(error.message) : t('Unknown global error')}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={reset} style={{ padding: '10px 16px' }}>
              {t('Retry render')}
            </button>
            <a
              href={`/${locale}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                color: '#334155',
                textDecoration: 'none',
                background: '#fff',
              }}
            >
              {t('Open home')}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
