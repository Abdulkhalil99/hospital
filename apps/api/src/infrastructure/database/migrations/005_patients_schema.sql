-- ============================================================
-- MIGRATION 005 — Patients schema
-- ============================================================

CREATE TABLE patients.patients (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn               VARCHAR(20)  NOT NULL UNIQUE,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  first_name_native VARCHAR(100),
  last_name_native  VARCHAR(100),
  date_of_birth     DATE         NOT NULL,
  gender            VARCHAR(10)  NOT NULL CHECK (gender IN ('male','female','other')),
  blood_type        VARCHAR(5)   NOT NULL DEFAULT 'unknown'
                      CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  national_id       VARCHAR(100),
  phone             VARCHAR(20)  NOT NULL,
  phone_alt         VARCHAR(20),
  email             VARCHAR(255),
  address           TEXT,
  city              VARCHAR(100),
  country           CHAR(2)      DEFAULT 'AF',
  has_allergies     BOOLEAN      NOT NULL DEFAULT FALSE,
  is_vip            BOOLEAN      NOT NULL DEFAULT FALSE,
  portal_user_id    UUID         REFERENCES auth.users(id),
  preferred_language CHAR(5)     NOT NULL DEFAULT 'fa'
                       REFERENCES i18n.languages(code),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by        UUID         NOT NULL REFERENCES auth.users(id),
  updated_by        UUID         REFERENCES auth.users(id),
  is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID         REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX idx_patients_mrn   ON patients.patients(mrn);
CREATE INDEX        idx_patients_phone ON patients.patients(phone);
CREATE INDEX        idx_patients_dob   ON patients.patients(date_of_birth);
CREATE INDEX        idx_patients_active ON patients.patients(is_active) WHERE is_deleted = FALSE;

-- Simple full-text search on name (no unaccent — avoids IMMUTABLE issue)
CREATE INDEX idx_patients_fulltext ON patients.patients
  USING gin(to_tsvector('simple',
    first_name || ' ' || last_name || ' ' ||
    COALESCE(first_name_native, '') || ' ' ||
    COALESCE(last_name_native, '')
  ));

-- Trigram indexes for partial name search
CREATE INDEX idx_patients_trgm_first ON patients.patients USING gin(first_name gin_trgm_ops);
CREATE INDEX idx_patients_trgm_last  ON patients.patients USING gin(last_name  gin_trgm_ops);

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients.patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER patients_audit
  AFTER INSERT OR UPDATE OR DELETE ON patients.patients
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

-- ── allergies ────────────────────────────────────────────────
CREATE TABLE patients.allergies (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID         NOT NULL REFERENCES patients.patients(id) ON DELETE CASCADE,
  allergen     VARCHAR(200) NOT NULL,
  reaction     VARCHAR(500) NOT NULL,
  severity     VARCHAR(20)  NOT NULL CHECK (severity IN (
                 'mild','moderate','severe','life_threatening')),
  onset_date   DATE,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  notes        TEXT,
  recorded_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  recorded_by  UUID         NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_allergies_patient ON patients.allergies(patient_id) WHERE is_active = TRUE;

-- Auto-update has_allergies flag
CREATE OR REPLACE FUNCTION sync_patient_allergy_flag()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE patients.patients
  SET has_allergies = EXISTS (
    SELECT 1 FROM patients.allergies
    WHERE patient_id = COALESCE(NEW.patient_id, OLD.patient_id)
    AND is_active = TRUE
  )
  WHERE id = COALESCE(NEW.patient_id, OLD.patient_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_allergy_flag
  AFTER INSERT OR UPDATE OR DELETE ON patients.allergies
  FOR EACH ROW EXECUTE FUNCTION sync_patient_allergy_flag();

-- ── patient_contacts ─────────────────────────────────────────
CREATE TABLE patients.patient_contacts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID         NOT NULL REFERENCES patients.patients(id) ON DELETE CASCADE,
  relationship VARCHAR(50)  NOT NULL,
  full_name    VARCHAR(200) NOT NULL,
  phone        VARCHAR(20)  NOT NULL,
  phone_alt    VARCHAR(20),
  is_primary   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_contacts ON patients.patient_contacts(patient_id);

-- ── patient_insurance ────────────────────────────────────────
CREATE TABLE patients.patient_insurance (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID         NOT NULL REFERENCES patients.patients(id) ON DELETE CASCADE,
  provider_name    VARCHAR(200) NOT NULL,
  policy_number    VARCHAR(100) NOT NULL,
  group_number     VARCHAR(100),
  subscriber_name  VARCHAR(200),
  valid_from       DATE         NOT NULL,
  valid_until      DATE,
  is_primary       BOOLEAN      NOT NULL DEFAULT TRUE,
  copay_percentage NUMERIC(5,2) DEFAULT 0,
  coverage_notes   TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_insurance ON patients.patient_insurance(patient_id);

-- ── consents ─────────────────────────────────────────────────
CREATE TABLE patients.consents (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID         NOT NULL REFERENCES patients.patients(id),
  consent_type   VARCHAR(100) NOT NULL,
  consent_text   TEXT         NOT NULL,
  signed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  signed_by      UUID         REFERENCES auth.users(id),
  signature_data TEXT,
  is_revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consents_patient ON patients.consents(patient_id);

-- ── chronic_conditions ───────────────────────────────────────
CREATE TABLE patients.chronic_conditions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID         NOT NULL REFERENCES patients.patients(id) ON DELETE CASCADE,
  condition    VARCHAR(200) NOT NULL,
  icd10_code   VARCHAR(10),
  diagnosed_at DATE,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  notes        TEXT,
  recorded_by  UUID         NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chronic_conditions_patient
  ON patients.chronic_conditions(patient_id) WHERE is_active = TRUE;
