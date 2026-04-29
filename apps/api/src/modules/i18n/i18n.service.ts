import { I18nRepository } from './i18n.repository';
import { loadTranslations } from '@/shared/utils/translate.util';
import { logger } from '@/infrastructure/logger/logger';
import type { Locale } from '@/shared/middleware/i18n.middleware';

export class I18nService {
  private repo = new I18nRepository();

  // Called once at app startup to warm the translation cache
  async loadAllTranslations(): Promise<void> {
    const locales: Locale[] = ['en', 'fa', 'ps'];
    for (const locale of locales) {
      const entries = await this.repo.getTranslationsByLocale(locale);
      loadTranslations(locale, entries);
      logger.info(`Loaded ${entries.length} translations for ${locale}`);
    }
  }

  async getLanguages() {
    return this.repo.getAllLanguages();
  }

  async getTranslations(locale: Locale) {
    return this.repo.getTranslationsByLocale(locale);
  }
}
