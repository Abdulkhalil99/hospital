-- ============================================================
-- MIGRATION 008 — EMR (Electronic Medical Records) schema
-- Purpose: The clinical heart of the system
-- Rule: Records lock after 24h — addendums only after that
-- ============================================================

-- ── encounters ───────────────────────────────────────────────
-- One encounter = one clinical visit (outpatient, inpatient, emergency).
-- Everything else in EMR hangs off an encounter.
CREATE TABLE emr.encounters (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID        NOT NULL REFERENCES patients.patients(id),
  doctor_id        UUID        NOT NULL REFERENCES doctors.doctors(id),
  appointment_id   UUID        REFERENCES appointments.appointments(id),
  emergency_visit_id UUID,                      -- FK added after emergency schema
  -- Type and status
  encounter_type   VARCHAR(20) NOT NULL DEFAULT 'outpatient'
                     CHECK (encounter_type IN ('outpatient','inpatient','emergency','telemedicine')),
  status           VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress','completed','voided')),
  -- Timing
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  -- Lock mechanism
  -- Records lock 24h after completion. After lock, only addendums allowed.
  locked_at        TIMESTAMPTZ,
  -- Chief complaint (why the patient came)
  chief_complaint  TEXT,
  -- Base audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        NOT NULL REFERENCES auth.users(id),
  updated_by       UUID        REFERENCES auth.users(id),
  is_deleted       BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  version          INTEGER     NOT NULL DEFAULT 1   -- optimistic locking
);

CREATE INDEX idx_encounters_patient      ON emr.encounters(patient_id);
CREATE INDEX idx_encounters_doctor       ON emr.encounters(doctor_id);
CREATE INDEX idx_encounters_date         ON emr.encounters(started_at DESC);
CREATE INDEX idx_encounters_status       ON emr.encounters(status) WHERE is_deleted = FALSE;

CREATE TRIGGER encounters_updated_at
  BEFORE UPDATE ON emr.encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER encounters_audit
  AFTER INSERT OR UPDATE OR DELETE ON emr.encounters
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

-- Auto-lock encounters 24 hours after completion
CREATE OR REPLACE FUNCTION lock_completed_encounters()
RETURNS void AS $$
BEGIN
  UPDATE emr.encounters
  SET locked_at = NOW()
  WHERE status = 'completed'
    AND locked_at IS NULL
    AND completed_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
-- Run this as a scheduled job every hour via pg_cron or app scheduler

-- ── vital_signs ──────────────────────────────────────────────
-- Stored as JSONB for flexibility — different specialties
-- record different vitals (pediatrics needs weight_for_age etc.)
CREATE TABLE emr.vital_signs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID        NOT NULL REFERENCES emr.encounters(id) ON DELETE CASCADE,
  patient_id   UUID        NOT NULL REFERENCES patients.patients(id),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by  UUID        NOT NULL REFERENCES auth.users(id),
  -- Core vitals as structured columns for easy querying/alerting
  temperature_c    NUMERIC(4,1),              -- Celsius
  bp_systolic      INTEGER,                   -- mmHg
  bp_diastolic     INTEGER,                   -- mmHg
  pulse_bpm        INTEGER,
  respiratory_rate INTEGER,
  o2_saturation    NUMERIC(5,2),              -- percentage
  weight_kg        NUMERIC(6,2),
  height_cm        NUMERIC(5,1),
  bmi              NUMERIC(5,2),              -- auto-computed below
  blood_glucose    NUMERIC(6,2),              -- mg/dL
  -- Extra vitals in JSONB (pain score, GCS, custom department fields)
  extra_vitals     JSONB,
  notes            TEXT
);

-- Auto-compute BMI on insert/update
CREATE OR REPLACE FUNCTION compute_bmi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.weight_kg IS NOT NULL AND NEW.height_cm IS NOT NULL AND NEW.height_cm > 0 THEN
    NEW.bmi := ROUND((NEW.weight_kg / ((NEW.height_cm / 100.0) ^ 2))::NUMERIC, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vitals_compute_bmi
  BEFORE INSERT OR UPDATE ON emr.vital_signs
  FOR EACH ROW EXECUTE FUNCTION compute_bmi();

CREATE INDEX idx_vitals_encounter ON emr.vital_signs(encounter_id);
CREATE INDEX idx_vitals_patient   ON emr.vital_signs(patient_id, recorded_at DESC);

-- ── clinical_notes ───────────────────────────────────────────
-- SOAP format: Subjective, Objective, Assessment, Plan.
-- is_addendum = TRUE means added after the 24h lock.
CREATE TABLE emr.clinical_notes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id   UUID        NOT NULL REFERENCES emr.encounters(id) ON DELETE CASCADE,
  note_type      VARCHAR(30) NOT NULL DEFAULT 'soap'
                   CHECK (note_type IN ('soap','progress','procedure','discharge','addendum')),
  subjective     TEXT,                       -- patient's own description
  objective      TEXT,                       -- examination findings
  assessment     TEXT,                       -- doctor's clinical assessment
  plan           TEXT,                       -- treatment plan
  full_text      TEXT,                       -- for non-SOAP notes
  is_addendum    BOOLEAN     NOT NULL DEFAULT FALSE,
  addendum_to_id UUID        REFERENCES emr.clinical_notes(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        NOT NULL REFERENCES auth.users(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_encounter ON emr.clinical_notes(encounter_id);

-- ── diagnoses ────────────────────────────────────────────────
-- ICD-10 coded diagnoses. Multiple per encounter.
CREATE TABLE emr.diagnoses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id   UUID        NOT NULL REFERENCES emr.encounters(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES patients.patients(id),
  icd10_code     VARCHAR(10) NOT NULL,        -- e.g. 'J06.9'
  icd10_name     VARCHAR(300) NOT NULL,       -- e.g. 'Acute upper respiratory infection'
  icd10_name_fa  VARCHAR(300),               -- Persian translation
  diagnosis_type VARCHAR(20) NOT NULL DEFAULT 'primary'
                   CHECK (diagnosis_type IN ('primary','secondary','differential')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_diagnoses_encounter ON emr.diagnoses(encounter_id);
CREATE INDEX idx_diagnoses_patient   ON emr.diagnoses(patient_id);
CREATE INDEX idx_diagnoses_icd10     ON emr.diagnoses(icd10_code);

-- ── prescriptions ────────────────────────────────────────────
-- Medication orders from doctor. Pharmacy reads this.
CREATE TABLE emr.prescriptions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      UUID        NOT NULL REFERENCES emr.encounters(id) ON DELETE CASCADE,
  patient_id        UUID        NOT NULL REFERENCES patients.patients(id),
  prescribed_by     UUID        NOT NULL REFERENCES auth.users(id),
  -- Drug info
  drug_name         VARCHAR(200) NOT NULL,
  generic_name      VARCHAR(200),
  dosage            VARCHAR(100) NOT NULL,    -- '500mg'
  frequency         VARCHAR(100) NOT NULL,    -- 'twice daily'
  route             VARCHAR(50)  NOT NULL DEFAULT 'oral'
                      CHECK (route IN ('oral','iv','im','sc','topical','inhaled','other')),
  duration_days     INTEGER,
  quantity          NUMERIC(8,2) NOT NULL,
  unit              VARCHAR(20)  NOT NULL DEFAULT 'tablet',
  instructions      TEXT,
  is_controlled     BOOLEAN      NOT NULL DEFAULT FALSE,   -- opioids, etc.
  -- Fulfillment
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','dispensed','cancelled','partial')),
  dispensed_at      TIMESTAMPTZ,
  dispensed_by      UUID         REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_encounter ON emr.prescriptions(encounter_id);
CREATE INDEX idx_prescriptions_patient   ON emr.prescriptions(patient_id);
CREATE INDEX idx_prescriptions_status    ON emr.prescriptions(status) WHERE status = 'pending';

-- ── lab_orders ───────────────────────────────────────────────
-- Ordered from EMR. Fulfilled by Laboratory module.
CREATE TABLE emr.lab_orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id    UUID        NOT NULL REFERENCES emr.encounters(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES patients.patients(id),
  ordered_by      UUID        NOT NULL REFERENCES auth.users(id),
  test_name       VARCHAR(200) NOT NULL,
  test_code       VARCHAR(50),
  urgency         VARCHAR(20)  NOT NULL DEFAULT 'routine'
                    CHECK (urgency IN ('routine','urgent','stat')),
  clinical_notes  TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'ordered'
                    CHECK (status IN ('ordered','sample_collected','processing','resulted','cancelled')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_orders_encounter ON emr.lab_orders(encounter_id);
CREATE INDEX idx_lab_orders_patient   ON emr.lab_orders(patient_id);
CREATE INDEX idx_lab_orders_status    ON emr.lab_orders(status);

-- ── imaging_orders ───────────────────────────────────────────
CREATE TABLE emr.imaging_orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id    UUID        NOT NULL REFERENCES emr.encounters(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES patients.patients(id),
  ordered_by      UUID        NOT NULL REFERENCES auth.users(id),
  modality        VARCHAR(20) NOT NULL
                    CHECK (modality IN ('xray','ct','mri','ultrasound','mammography','other')),
  body_part       VARCHAR(100) NOT NULL,
  urgency         VARCHAR(20)  NOT NULL DEFAULT 'routine',
  clinical_indication TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'ordered'
                    CHECK (status IN ('ordered','scheduled','performed','reported','cancelled')),
  report_text     TEXT,
  reported_by     UUID         REFERENCES auth.users(id),
  reported_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_imaging_orders_encounter ON emr.imaging_orders(encounter_id);
CREATE INDEX idx_imaging_orders_patient   ON emr.imaging_orders(patient_id);

-- ── referrals ────────────────────────────────────────────────
CREATE TABLE emr.referrals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id    UUID        NOT NULL REFERENCES emr.encounters(id),
  patient_id      UUID        NOT NULL REFERENCES patients.patients(id),
  referred_by     UUID        NOT NULL REFERENCES auth.users(id),
  referred_to_doctor_id UUID  REFERENCES doctors.doctors(id),
  referred_to_specialty_id UUID REFERENCES doctors.specialties(id),
  referred_to_external TEXT,              -- external hospital/clinic name
  reason          TEXT        NOT NULL,
  urgency         VARCHAR(20) NOT NULL DEFAULT 'routine',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','completed','declined')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referrals_patient ON emr.referrals(patient_id);