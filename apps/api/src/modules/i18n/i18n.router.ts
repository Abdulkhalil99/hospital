import { Router } from 'express';
import { I18nService } from './i18n.service';
import { asyncHandler } from '@/shared/utils/async-handler';

export const i18nRouter = Router();
const service = new I18nService();

// GET /api/v1/i18n/languages — list all supported languages
i18nRouter.get('/languages', asyncHandler(async (_req, res) => {
  const languages = await service.getLanguages();
  res.json({ success: true, data: languages });
}));

// GET /api/v1/i18n/:locale — get all translations for a locale (used by frontend)
i18nRouter.get('/:locale', asyncHandler(async (req, res) => {
  const locale    = req.params.locale as 'en' | 'fa' | 'ps';
  const supported = ['en', 'fa', 'ps'];
  if (!supported.includes(locale)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_LOCALE', message: `Unsupported locale: ${locale}` },
    });
    return;
  }
  const translations = await service.getTranslations(locale);
  res.json({ success: true, data: translations });
}));
