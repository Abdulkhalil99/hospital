CREATE TABLE settings.hospital_settings (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_name            VARCHAR(200) NOT NULL DEFAULT 'MediCore Hospital',
  hospital_name_fa         VARCHAR(200),
  hospital_name_ps         VARCHAR(200),
  logo_url                 VARCHAR(500),
  address                  TEXT,
  address_fa               TEXT,
  phone                    VARCHAR(20),
  email                    VARCHAR(255),
  website                  VARCHAR(255),
  default_language         CHAR(5)      NOT NULL DEFAULT 'fa' REFERENCES i18n.languages(code),
  default_currency         VARCHAR(3)   NOT NULL DEFAULT 'AFN',
  timezone                 VARCHAR(50)  NOT NULL DEFAULT 'Asia/Kabul',
  work_start_time          TIME         NOT NULL DEFAULT '08:00',
  work_end_time            TIME         NOT NULL DEFAULT '17:00',
  friday_closed            BOOLEAN      NOT NULL DEFAULT TRUE,
  mrn_prefix               VARCHAR(10)  NOT NULL DEFAULT 'MC-',
  mrn_pad_length           SMALLINT     NOT NULL DEFAULT 6,
  default_slot_minutes     INTEGER      NOT NULL DEFAULT 15,
  max_advance_booking_days INTEGER      NOT NULL DEFAULT 90,
  emr_lock_after_hours     INTEGER      NOT NULL DEFAULT 24,
  tax_rate_percent         NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by               UUID         REFERENCES auth.users(id)
);
INSERT INTO settings.hospital_settings DEFAULT VALUES;

CREATE TABLE settings.feature_flags (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key    VARCHAR(100) NOT NULL UNIQUE,
  is_enabled  BOOLEAN      NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  UUID         REFERENCES auth.users(id)
);
INSERT INTO settings.feature_flags (flag_key, is_enabled, description) VALUES
  ('module.emergency',       TRUE,  'Emergency department module'),
  ('module.pharmacy',        TRUE,  'Pharmacy management module'),
  ('module.laboratory',      TRUE,  'Laboratory module'),
  ('module.radiology',       FALSE, 'Radiology module'),
  ('module.inpatient',       FALSE, 'Inpatient/ward management'),
  ('module.theatre',         FALSE, 'Operating theatre management'),
  ('module.telemedicine',    FALSE, 'Video consultation module'),
  ('feature.patient_portal', FALSE, 'Patient self-service portal'),
  ('feature.sms',            FALSE, 'SMS notification channel'),
  ('feature.push',           FALSE, 'Mobile push notifications');

CREATE TABLE settings.public_holidays (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(200) NOT NULL,
  name_fa      VARCHAR(200),
  holiday_date DATE         NOT NULL UNIQUE,
  is_recurring BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE settings.sequences (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_name  VARCHAR(50) NOT NULL UNIQUE,
  prefix         VARCHAR(20) NOT NULL DEFAULT '',
  current_value  BIGINT      NOT NULL DEFAULT 0,
  pad_length     SMALLINT    NOT NULL DEFAULT 6,
  reset_daily    BOOLEAN     NOT NULL DEFAULT FALSE,
  last_reset_date DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO settings.sequences (sequence_name, prefix, pad_length, reset_daily) VALUES
  ('mrn',         'MC-',  6, FALSE),
  ('invoice',     'INV-', 6, FALSE),
  ('receipt',     'RCP-', 6, FALSE),
  ('queue_token', '',     3, TRUE);

CREATE OR REPLACE FUNCTION settings.next_sequence(p_name VARCHAR)
RETURNS TEXT AS $$
DECLARE
  v_row    settings.sequences%ROWTYPE;
  v_next   BIGINT;
  v_reset  BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_row FROM settings.sequences WHERE sequence_name = p_name FOR UPDATE;
  IF v_row.reset_daily AND (v_row.last_reset_date IS NULL OR v_row.last_reset_date < CURRENT_DATE) THEN
    v_next  := 1;
    v_reset := TRUE;
  ELSE
    v_next := v_row.current_value + 1;
  END IF;
  UPDATE settings.sequences SET
    current_value   = v_next,
    last_reset_date = CASE WHEN v_reset THEN CURRENT_DATE ELSE last_reset_date END,
    updated_at      = NOW()
  WHERE sequence_name = p_name;
  RETURN v_row.prefix ||
         TO_CHAR(NOW(), 'YYYY-') ||
         LPAD(v_next::TEXT, v_row.pad_length, '0');
END;
$$ LANGUAGE plpgsql;
