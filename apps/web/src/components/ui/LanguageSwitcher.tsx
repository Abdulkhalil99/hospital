'use client';
import { useLocale }  from '@/hooks/useLocale';
import type { Locale } from '@/i18n/request';

const LANGUAGES: { code: Locale; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fa', label: 'Persian', native: 'فارسی'   },
  { code: 'ps', label: 'Pashto',  native: 'پښتو'    },
];

export function LanguageSwitcher() {
  const { locale, switchLocale } = useLocale();

  return (
    <div className="flex items-center gap-1">
      {LANGUAGES.map(lang => (
        <button
          key={lang.code}
          onClick={() => switchLocale(lang.code)}
          className={[
            'px-3 py-1.5 rounded-md text-sm transition-colors',
            locale === lang.code
              ? 'bg-blue-50 text-blue-800 font-medium border border-blue-200'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
          ].join(' ')}
          lang={lang.code}
          dir={['fa','ps'].includes(lang.code) ? 'rtl' : 'ltr'}
          aria-label={`Switch to ${lang.label}`}
          aria-pressed={locale === lang.code}
        >
          {lang.native}
        </button>
      ))}
    </div>
  );
}
