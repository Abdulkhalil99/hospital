import { Request, Response, NextFunction } from 'express';

const SUPPORTED_LOCALES = ['en', 'fa', 'ps'] as const;
type Locale = typeof SUPPORTED_LOCALES[number];

declare global {
  namespace Express {
    interface Request { locale: Locale; }
  }
}

export function i18nMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header  = req.headers['accept-language'] ?? '';
  const query   = req.query.locale as string ?? '';
  const raw     = query || header.split(',')[0]?.split('-')[0] ?? 'en';
  req.locale    = SUPPORTED_LOCALES.includes(raw as Locale) ? raw as Locale : 'en';
  next();
}
