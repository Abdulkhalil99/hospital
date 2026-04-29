import type { Locale } from '@/shared/middleware/i18n.middleware';

// In-memory cache populated from DB at startup and on change
const cache = new Map<string, Map<string, string>>();

// Seed with essential error messages so the app works before DB loads
const BUILTIN: Record<Locale, Record<string, string>> = {
  en: {
    'error.unauthorized':         'You are not authorised to perform this action',
    'error.forbidden':            'You do not have permission: {{permission}}',
    'error.not_found':            '{{resource}} not found',
    'error.validation':           'Request validation failed',
    'error.conflict':             'A record with these details already exists',
    'error.internal':             'An unexpected error occurred. Please try again.',
    'error.rate_limit':           'Too many requests. Please try again in {{minutes}} minutes.',
    'auth.invalid_credentials':   'Invalid username or password',
    'auth.account_locked':        'Account locked. Try again in {{minutes}} minute(s).',
    'auth.token_expired':         'Your session has expired. Please log in again.',
    'auth.account_inactive':      'This account is not active.',
  },
  fa: {
    'error.unauthorized':         'شما مجاز به انجام این عمل نیستید',
    'error.forbidden':            'شما دسترسی لازم را ندارید: {{permission}}',
    'error.not_found':            '{{resource}} یافت نشد',
    'error.validation':           'اطلاعات ارسالی معتبر نیست',
    'error.conflict':             'رکوردی با این مشخصات از قبل وجود دارد',
    'error.internal':             'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.',
    'error.rate_limit':           'درخواست‌های زیاد. {{minutes}} دقیقه دیگر امتحان کنید.',
    'auth.invalid_credentials':   'نام کاربری یا رمز عبور اشتباه است',
    'auth.account_locked':        'حساب قفل شده است. {{minutes}} دقیقه دیگر تلاش کنید.',
    'auth.token_expired':         'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
    'auth.account_inactive':      'این حساب فعال نیست.',
  },
  ps: {
    'error.unauthorized':         'تاسو د دې عمل ترسره کولو واک نه لرئ',
    'error.forbidden':            'تاسو اجازه نه لرئ: {{permission}}',
    'error.not_found':            '{{resource}} ونه موندل شو',
    'error.validation':           'لیږل شوي معلومات سم نه دي',
    'error.conflict':             'د دې جزئیاتو سره ریکارډ دمخه شتون لري',
    'error.internal':             'غیر متوقع تیروتنه. بیا هڅه وکړئ.',
    'error.rate_limit':           'ډیرې غوښتنې. {{minutes}} دقیقې وروسته هڅه وکړئ.',
    'auth.invalid_credentials':   'کاروونکي نوم یا پاسورډ غلط دی',
    'auth.account_locked':        'حساب بند دی. {{minutes}} دقیقې وروسته هڅه وکړئ.',
    'auth.token_expired':         'ستاسو غونډه پای ته رسیدلې ده. بیا ننوځئ.',
    'auth.account_inactive':      'دا حساب فعال نه دی.',
  },
};

// Load builtins into cache
for (const [locale, strings] of Object.entries(BUILTIN)) {
  cache.set(locale, new Map(Object.entries(strings)));
}

// Load additional translations from DB (called at startup)
export function loadTranslations(
  locale: Locale,
  entries: { key: string; value: string }[],
): void {
  if (!cache.has(locale)) cache.set(locale, new Map());
  const map = cache.get(locale)!;
  for (const { key, value } of entries) map.set(key, value);
}

// Translate a key with optional variable interpolation
// t('auth.account_locked', 'fa', { minutes: '5' }) → 'حساب قفل شده است. ۵ دقیقه دیگر...'
export function t(
  key:       string,
  locale:    Locale,
  vars?:     Record<string, string>,
): string {
  const map      = cache.get(locale);
  const fallback = cache.get('en');

  let value = map?.get(key) ?? fallback?.get(key) ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`{{${k}}}`, 'g'), v);
    }
  }

  return value;
}
