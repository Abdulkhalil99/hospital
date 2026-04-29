import { getDb } from '@/infrastructure/database/db.client';
import type { Locale } from '@/shared/middleware/i18n.middleware';

export class I18nRepository {
  private db = getDb();

  async getTranslationsByLocale(
    locale: Locale,
  ): Promise<{ key: string; value: string }[]> {
    const { rows } = await this.db.query<{ key: string; value: string }>(
      `SELECT key, value FROM i18n.translations
       WHERE locale_code = $1
       ORDER BY key`,
      [locale],
    );
    return rows;
  }

  async getAllLanguages(): Promise<{
    code: string; name: string; native_name: string; is_rtl: boolean;
  }[]> {
    const { rows } = await this.db.query(
      `SELECT code, name, native_name, is_rtl
       FROM i18n.languages
       WHERE is_active = TRUE
       ORDER BY sort_order`,
    );
    return rows;
  }

  async upsertTranslation(
    key:    string,
    locale: Locale,
    value:  string,
    module: string,
    userId: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO i18n.translations (key, locale_code, value, module, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key, locale_code)
       DO UPDATE SET value = $3, updated_at = NOW(), updated_by = $5`,
      [key, locale, value, module, userId],
    );
  }
}
