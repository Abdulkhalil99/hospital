-- ============================================================
-- MIGRATION 018 — Patient OTP verification + family accounts
-- ============================================================

-- ── OTP verification codes ───────────────────────────────────
CREATE TABLE patients.otp_codes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target       VARCHAR(255) NOT NULL,   -- phone number or email address
  target_type  VARCHAR(10)  NOT NULL CHECK (target_type IN ('phone','email')),
  code_hash    VARCHAR(255) NOT NULL,   -- bcrypt hash of the 6-digit code
  purpose      VARCHAR(30)  NOT NULL DEFAULT 'registration'
                 CHECK (purpose IN ('registration','portal_login','verify_contact','password_reset')),
  patient_id   UUID         REFERENCES patients.patients(id),
  attempts     INTEGER      NOT NULL DEFAULT 0,
  max_attempts INTEGER      NOT NULL DEFAULT 3,
  expires_at   TIMESTAMPTZ  NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otp_target   ON patients.otp_codes(target, target_type) WHERE used_at IS NULL;
CREATE INDEX idx_otp_expires  ON patients.otp_codes(expires_at) WHERE used_at IS NULL;

-- ── Family account relationships ──────────────────────────────
CREATE TABLE patients.family_members (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_patient_id UUID      NOT NULL REFERENCES patients.patients(id) ON DELETE CASCADE,
  member_patient_id  UUID      NOT NULL REFERENCES patients.patients(id) ON DELETE CASCADE,
  relationship     VARCHAR(30) NOT NULL
                     CHECK (relationship IN ('spouse','child','parent','sibling','guardian','caregiver','other')),
  access_level     VARCHAR(20) NOT NULL DEFAULT 'view_only'
                     CHECK (access_level IN ('view_only','full','guardian')),
  -- Consent tracking
  consent_given_at  TIMESTAMPTZ,
  consent_given_by  UUID        REFERENCES auth.users(id),
  consent_otp_verified BOOLEAN  NOT NULL DEFAULT FALSE,
  -- Status
  status           VARCHAR(20)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','pending_consent','revoked')),
  linked_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  linked_by        UUID         NOT NULL REFERENCES auth.users(id),
  revoked_at       TIMESTAMPTZ,
  revoked_by       UUID         REFERENCES auth.users(id),
  notes            TEXT,
  -- A patient cannot link to themselves
  CHECK (primary_patient_id <> member_patient_id),
  UNIQUE (primary_patient_id, member_patient_id)
);
CREATE INDEX idx_family_primary ON patients.family_members(primary_patient_id) WHERE status = 'active';
CREATE INDEX idx_family_member  ON patients.family_members(member_patient_id)  WHERE status = 'active';

-- ── Sensitive record flags ────────────────────────────────────
CREATE TABLE patients.record_restrictions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES patients.patients(id) ON DELETE CASCADE,
  restriction_type VARCHAR(50) NOT NULL
                     CHECK (restriction_type IN ('mental_health','hiv','reproductive','substance_use','other')),
  restricted_by UUID        NOT NULL REFERENCES auth.users(id),
  restricted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT
);
CREATE INDEX idx_restrictions_patient ON patients.record_restrictions(patient_id);

-- ── Medical history summary view ──────────────────────────────
CREATE VIEW patients.v_medical_history AS
SELECT
  p.id               AS patient_id,
  p.mrn,
  p.first_name || ' ' || p.last_name AS full_name,
  -- Encounter counts
  (SELECT COUNT(*) FROM emr.encounters e
   WHERE e.patient_id = p.id AND e.is_deleted = FALSE)             AS total_encounters,
  -- Last visit
  (SELECT MAX(e.started_at) FROM emr.encounters e
   WHERE e.patient_id = p.id AND e.is_deleted = FALSE)             AS last_visit_at,
  -- Active diagnoses
  (SELECT ARRAY_AGG(d.icd10_name ORDER BY d.created_at DESC)
   FROM emr.diagnoses d
   JOIN emr.encounters e ON e.id = d.encounter_id
   WHERE d.patient_id = p.id AND e.is_deleted = FALSE)             AS diagnoses,
  -- Current medications
  (SELECT ARRAY_AGG(pr.drug_name ORDER BY pr.created_at DESC)
   FROM emr.prescriptions pr
   WHERE pr.patient_id = p.id AND pr.status = 'dispensed')        AS current_medications,
  -- Allergies
  (SELECT ARRAY_AGG(a.allergen || ' (' || a.severity || ')')
   FROM patients.allergies a
   WHERE a.patient_id = p.id AND a.is_active = TRUE)              AS allergies,
  -- Lab results count
  (SELECT COUNT(*) FROM laboratory.lab_results lr
   WHERE lr.patient_id = p.id AND lr.validated_at IS NOT NULL)     AS total_lab_results,
  p.has_allergies,
  p.blood_type,
  p.date_of_birth
FROM patients.patients p
WHERE p.is_deleted = FALSE;
