-- ============================================================
-- MIGRATION 003 — i18n (Multi-language) schema
-- Purpose: English, Persian (RTL), Pashto (RTL) support
-- Run order: THIRD — auth schema references language codes
-- ============================================================

-- ── languages ────────────────────────────────────────────────
-- Master list of supported locales.
-- is_rtl tells the frontend to flip its layout direction.
CREATE TABLE i18n.languages (
  code         CHAR(5)      PRIMARY KEY,   -- 'en', 'fa', 'ps'
  name         VARCHAR(50)  NOT NULL,      -- 'English', 'فارسی', 'پښتو'
  native_name  VARCHAR(50)  NOT NULL,      -- name in that language itself
  is_rtl       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order   INTEGER      NOT NULL DEFAULT 0
);

-- Seed the three required languages immediately
INSERT INTO i18n.languages (code, name, native_name, is_rtl, sort_order) VALUES
  ('en', 'English', 'English', FALSE, 1),
  ('fa', 'Persian', 'فارسی',   TRUE,  2),
  ('ps', 'Pashto',  'پښتو',    TRUE,  3);

-- ── translations ─────────────────────────────────────────────
-- Key-value store for every translatable string.
-- key:         dot-notation, e.g. 'patient.register.title'
-- locale_code: 'en' | 'fa' | 'ps'
-- value:       the translated string in that language
--
-- Why in the database (not JSON files)?
-- Admins can edit translations without a deployment.
CREATE TABLE i18n.translations (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key          VARCHAR(200) NOT NULL,
  locale_code  CHAR(5)      NOT NULL REFERENCES i18n.languages(code),
  value        TEXT         NOT NULL,
  module       VARCHAR(50),               -- 'patients', 'billing', etc. — for filtering
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by   UUID,
  UNIQUE (key, locale_code)
);

CREATE INDEX idx_translations_key    ON i18n.translations (key);
CREATE INDEX idx_translations_locale ON i18n.translations (locale_code);
CREATE INDEX idx_translations_module ON i18n.translations (module);

-- Seed essential base translations
INSERT INTO i18n.translations (key, locale_code, value, module) VALUES
  -- Common
  ('common.save',           'en', 'Save',      'common'),
  ('common.save',           'fa', 'ذخیره',     'common'),
  ('common.save',           'ps', 'خوندي کړئ', 'common'),
  ('common.cancel',         'en', 'Cancel',    'common'),
  ('common.cancel',         'fa', 'لغو',       'common'),
  ('common.cancel',         'ps', 'لغوه',      'common'),
  ('common.loading',        'en', 'Loading...','common'),
  ('common.loading',        'fa', 'بارگذاری...','common'),
  ('common.loading',        'ps', 'بار کیږي...','common'),
  -- Patient module
  ('patient.mrn.label',     'en', 'Medical Record Number', 'patients'),
  ('patient.mrn.label',     'fa', 'شماره پرونده پزشکی',   'patients'),
  ('patient.mrn.label',     'ps', 'د طبي ریکارډ شمیره',   'patients'),
  -- Error messages
  ('error.unauthorized',    'en', 'You are not authorised to perform this action', 'errors'),
  ('error.unauthorized',    'fa', 'شما مجاز به انجام این عمل نیستید',             'errors'),
  ('error.unauthorized',    'ps', 'تاسو د دې عمل د ترسره کولو واک نه لرئ',      'errors');