export const LOCALES = {
  EN: 'en',
  FA: 'fa',
  PS: 'ps',
} as const;

export type Locale = typeof LOCALES[keyof typeof LOCALES];
