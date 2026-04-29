-- ============================================================
-- MIGRATION 010 — Laboratory schema
-- Purpose: Sample collection, processing, results, critical alerts
-- ============================================================

-- ── lab_tests ────────────────────────────────────────────────
-- Master catalog of every test the lab can perform.
CREATE TABLE laboratory.lab_tests (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(20)  NOT NULL UNIQUE,    -- 'CBC', 'LFT', 'TSH'
  name              VARCHAR(200) NOT NULL,
  name_fa           VARCHAR(200),
  category          VARCHAR(100) NOT NULL,           -- 'Hematology', 'Biochemistry'
  sample_type       VARCHAR(50)  NOT NULL DEFAULT 'blood'
                      CHECK (sample_type IN ('blood','urine','stool','csf','swab','tissue','other')),
  sample_volume_ml  NUMERIC(5,2),
  container_type    VARCHAR(100),                   -- 'EDTA tube', 'plain tube'
  turnaround_hours  INTEGER      NOT NULL DEFAULT 24,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3)   DEFAULT 'AFN',
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── reference_ranges ─────────────────────────────────────────
-- Normal ranges for each test result component.
-- Age and gender specific (child vs adult, male vs female differ).
CREATE TABLE laboratory.reference_ranges (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_test_id       UUID         NOT NULL REFERENCES laboratory.lab_tests(id),
  component_name    VARCHAR(100) NOT NULL,   -- 'WBC', 'Hemoglobin', 'Glucose'
  unit              VARCHAR(30)  NOT NULL,   -- 'g/dL', 'cells/µL', 'mg/dL'
  -- Ranges vary by gender and age
  gender            VARCHAR(10)  DEFAULT 'all' CHECK (gender IN ('all','male','female')),
  age_min_years     INTEGER      DEFAULT 0,
  age_max_years     INTEGER      DEFAULT 999,
  normal_min        NUMERIC(12,4),
  normal_max        NUMERIC(12,4),
  critical_low      NUMERIC(12,4),           -- trigger immediate alert
  critical_high     NUMERIC(12,4),           -- trigger immediate alert
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ref_ranges_test ON laboratory.reference_ranges(lab_test_id);

-- ── lab_samples ──────────────────────────────────────────────
-- Physical sample tracking. Each sample has a barcode.
CREATE TABLE laboratory.lab_samples (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL REFERENCES emr.lab_orders(id),
  patient_id       UUID        NOT NULL REFERENCES patients.patients(id),
  lab_test_id      UUID        NOT NULL REFERENCES laboratory.lab_tests(id),
  barcode          VARCHAR(50) NOT NULL UNIQUE,
  sample_type      VARCHAR(50) NOT NULL,
  -- Collection
  collected_at     TIMESTAMPTZ,
  collected_by     UUID        REFERENCES auth.users(id),
  -- Processing
  received_at      TIMESTAMPTZ,
  received_by      UUID        REFERENCES auth.users(id),
  -- Status lifecycle
  status           VARCHAR(20) NOT NULL DEFAULT 'ordered'
                     CHECK (status IN (
                       'ordered','collected','received','processing',
                       'resulted','rejected','cancelled'
                     )),
  rejection_reason VARCHAR(200),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_samples_order   ON laboratory.lab_samples(order_id);
CREATE INDEX idx_lab_samples_patient ON laboratory.lab_samples(patient_id);
CREATE INDEX idx_lab_samples_barcode ON laboratory.lab_samples(barcode);
CREATE INDEX idx_lab_samples_status  ON laboratory.lab_samples(status);

-- ── lab_results ──────────────────────────────────────────────
-- One row per result component per sample.
-- Critical values trigger immediate notification to ordering doctor.
CREATE TABLE laboratory.lab_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id         UUID        NOT NULL REFERENCES laboratory.lab_samples(id),
  order_id          UUID        NOT NULL REFERENCES emr.lab_orders(id),
  patient_id        UUID        NOT NULL REFERENCES patients.patients(id),
  component_name    VARCHAR(100) NOT NULL,
  result_value      VARCHAR(200),           -- stored as text to handle '<0.01', '>1000'
  result_numeric    NUMERIC(14,4),          -- numeric copy for range comparison
  unit              VARCHAR(30),
  -- Range interpretation
  normal_min        NUMERIC(12,4),
  normal_max        NUMERIC(12,4),
  flag              VARCHAR(10),            -- 'H', 'L', 'HH', 'LL', 'N'
  is_critical       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Validation workflow
  entered_by        UUID        NOT NULL REFERENCES auth.users(id),
  entered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_by      UUID        REFERENCES auth.users(id),
  validated_at      TIMESTAMPTZ,
  -- Release to patient portal (only after doctor reviews)
  released_at       TIMESTAMPTZ,
  released_by       UUID        REFERENCES auth.users(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_results_sample  ON laboratory.lab_results(sample_id);
CREATE INDEX idx_lab_results_patient ON laboratory.lab_results(patient_id);
CREATE INDEX idx_lab_results_order   ON laboratory.lab_results(order_id);
CREATE INDEX idx_lab_results_critical ON laboratory.lab_results(is_critical)
  WHERE is_critical = TRUE AND validated_at IS NOT NULL;

-- ── critical_value_alerts ────────────────────────────────────
-- When a critical result is validated, this table drives
-- the immediate notification to the ordering doctor.
CREATE TABLE laboratory.critical_value_alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id         UUID        NOT NULL REFERENCES laboratory.lab_results(id),
  patient_id        UUID        NOT NULL REFERENCES patients.patients(id),
  ordering_doctor_id UUID       NOT NULL REFERENCES doctors.doctors(id),
  alert_sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at   TIMESTAMPTZ,
  acknowledged_by   UUID        REFERENCES auth.users(id),
  acknowledgment_note TEXT,
  escalated_at      TIMESTAMPTZ,               -- if not ack within 30 mins
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-create critical alert when critical result validated
CREATE OR REPLACE FUNCTION create_critical_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_doctor_id UUID;
BEGIN
  IF NEW.is_critical = TRUE AND NEW.validated_at IS NOT NULL
     AND (OLD.validated_at IS NULL OR OLD.is_critical = FALSE) THEN
    -- Find the ordering doctor through the order
    SELECT d.id INTO v_doctor_id
    FROM emr.lab_orders lo
    JOIN emr.encounters e ON e.id = lo.encounter_id
    JOIN doctors.doctors d ON d.user_id = e.doctor_id
    WHERE lo.id = NEW.order_id
    LIMIT 1;

    IF v_doctor_id IS NOT NULL THEN
      INSERT INTO laboratory.critical_value_alerts
        (result_id, patient_id, ordering_doctor_id)
      VALUES
        (NEW.id, NEW.patient_id, v_doctor_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_critical_result_validated
  AFTER INSERT OR UPDATE ON laboratory.lab_results
  FOR EACH ROW EXECUTE FUNCTION create_critical_alert();