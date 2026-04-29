import { Request, Response, NextFunction } from 'express';

export type Locale = 'en' | 'fa' | 'ps';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'fa', 'ps'];
export const DEFAULT_LOCALE: Locale      = 'en';
export const RTL_LOCALES: Locale[]       = ['fa', 'ps'];

declare global {
  namespace Express {
    interface Request {
      locale: Locale;
      isRTL:  boolean;
    }
  }
}

export function i18nMiddleware(
  req:  Request,
  _res: Response,
  next: NextFunction,
): void {
  // Priority: query param → Accept-Language header → user preference → default
  const fromQuery  = req.query.lang  as string | undefined;
  const fromHeader = req.headers['accept-language']?.split(',')[0]?.split('-')[0];
  const fromUser   = req.user?.preferredLanguage as string | undefined;

  const raw    = fromQuery ?? fromUser ?? fromHeader ?? DEFAULT_LOCALE;
  const locale = SUPPORTED_LOCALES.includes(raw as Locale)
    ? (raw as Locale)
    : DEFAULT_LOCALE;

  req.locale = locale;
  req.isRTL  = RTL_LOCALES.includes(locale);

  next();
}
