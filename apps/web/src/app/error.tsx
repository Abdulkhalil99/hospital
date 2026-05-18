'use client';
import { usePathname } from 'next/navigation';
import { useT, isRTL } from '@/lib/i18n';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};
export default function RootError({ error, reset }: ErrorPageProps) {
  const pathname = usePathname();
  const locale = ['en', 'fa', 'ps'].includes(pathname.split('/')[1] ?? '')
    ? pathname.split('/')[1]
    : 'en';
  const t = useT(locale);
  const rtl = isRTL(locale);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: 24,
        direction: rtl ? 'rtl' : 'ltr',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>
          {t('Something went wrong')}
        </div>
        <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: '0 0 10px', color: '#0f172a' }}>
          {t('The page could not finish rendering.')}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#475569', margin: '0 0 18px' }}>
          {t('Try refreshing the page or retrying the last action. If the problem keeps happening, check the dev server logs for the original stack trace.')}
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
          {error.message ? t(error.message) : t('Unknown application error')}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={reset} style={{ padding: '10px 16px' }}>
            {t('Try again')}
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
            {t('Go to home')}
          </a>
        </div>
      </div>
    </div>
  );
}
