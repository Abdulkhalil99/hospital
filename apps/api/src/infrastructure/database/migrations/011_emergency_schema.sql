-- ============================================================
-- MIGRATION 011 — Emergency schema
-- Purpose: Fast triage, bed management, trauma activation
-- Design: patient_id is nullable (unknown patients in emergencies)
-- ============================================================

-- ── emergency_beds ───────────────────────────────────────────
-- Physical beds in the emergency department.
CREATE TABLE emergency.emergency_beds (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_code     VARCHAR(20) NOT NULL UNIQUE,   -- 'ED-01', 'RESUS-A'
  bed_type     VARCHAR(30) NOT NULL DEFAULT 'general'
                 CHECK (bed_type IN ('general','resuscitation','isolation','paediatric','observation')),
  location     VARCHAR(100),                  -- 'Bay 1', 'Resus Room'
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO emergency.emergency_beds (bed_code, bed_type, location) VALUES
  ('RESUS-A',  'resuscitation', 'Resuscitation Room'),
  ('RESUS-B',  'resuscitation', 'Resuscitation Room'),
  ('ISO-1',    'isolation',     'Isolation Bay'),
  ('ED-01',    'general',       'Bay 1'),
  ('ED-02',    'general',       'Bay 1'),
  ('ED-03',    'general',       'Bay 1'),
  ('ED-04',    'general',       'Bay 2'),
  ('ED-05',    'general',       'Bay 2'),
  ('PEDS-1',   'paediatric',    'Paediatric Bay'),
  ('OBS-1',    'observation',   'Observation Area'),
  ('OBS-2',    'observation',   'Observation Area');

-- ── emergency_visits ─────────────────────────────────────────
-- Created the moment an emergency patient arrives.
-- Minimal required fields — speed is critical.
CREATE TABLE emergency.emergency_visits (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Patient may be unknown on arrival
  patient_id        UUID        REFERENCES patients.patients(id),
  unknown_patient_info JSONB,              -- {name, age_estimate, description}
  -- Arrival
  arrived_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arrival_mode      VARCHAR(30) NOT NULL DEFAULT 'walk_in'
                      CHECK (arrival_mode IN ('walk_in','ambulance','police','transfer','other')),
  -- Triage
  triage_level      SMALLINT    CHECK (triage_level BETWEEN 1 AND 5),
  -- ESI levels: 1=immediate, 2=emergent, 3=urgent, 4=less urgent, 5=non-urgent
  triage_color      VARCHAR(10),           -- 'red','orange','yellow','green','blue'
  chief_complaint   TEXT        NOT NULL,
  -- Bed
  bed_id            UUID        REFERENCES emergency.emergency_beds(id),
  -- Status lifecycle
  status            VARCHAR(20) NOT NULL DEFAULT 'arrived'
                      CHECK (status IN (
                        'arrived','triaged','in_treatment',
                        'observation','discharged','transferred','deceased','left_without_seen'
                      )),
  -- Outcome
  discharged_at     TIMESTAMPTZ,
  disposition       VARCHAR(50),           -- 'discharge_home', 'admit', 'transfer', 'deceased'
  -- Linked EMR encounter (created after triage)
  encounter_id      UUID        REFERENCES emr.encounters(id),
  -- Base audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        NOT NULL REFERENCES auth.users(id),
  updated_by        UUID        REFERENCES auth.users(id)
);

CREATE INDEX idx_emv_patient ON emergency.emergency_visits(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_emv_status  ON emergency.emergency_visits(status) WHERE status NOT IN ('discharged','transferred');
CREATE INDEX idx_emv_date    ON emergency.emergency_visits USING BRIN (arrived_at);
CREATE INDEX idx_emv_bed     ON emergency.emergency_visits(bed_id) WHERE bed_id IS NOT NULL;

CREATE TRIGGER emvisits_updated_at
  BEFORE UPDATE ON emergency.emergency_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER emvisits_audit
  AFTER INSERT OR UPDATE OR DELETE ON emergency.emergency_visits
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

-- ── triage_assessments ───────────────────────────────────────
-- Full triage record done by nurse.
CREATE TABLE emergency.triage_assessments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id         UUID        NOT NULL REFERENCES emergency.emergency_visits(id) ON DELETE CASCADE,
  triaged_by       UUID        NOT NULL REFERENCES auth.users(id),
  triaged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ESI triage level (1–5)
  esi_level        SMALLINT    NOT NULL CHECK (esi_level BETWEEN 1 AND 5),
  -- Presenting vitals at triage
  temperature_c    NUMERIC(4,1),
  bp_systolic      INTEGER,
  bp_diastolic     INTEGER,
  pulse_bpm        INTEGER,
  respiratory_rate INTEGER,
  o2_saturation    NUMERIC(5,2),
  gcs_score        INTEGER CHECK (gcs_score BETWEEN 3 AND 15),  -- Glasgow Coma Scale
  pain_score       SMALLINT    CHECK (pain_score BETWEEN 0 AND 10),
  weight_kg        NUMERIC(6,2),
  -- Assessment
  mechanism_of_injury TEXT,
  allergies_noted  TEXT,
  medications_noted TEXT,
  triage_notes     TEXT
);

CREATE INDEX idx_triage_visit ON emergency.triage_assessments(visit_id);

-- ── bed_assignments ──────────────────────────────────────────
-- History of bed assignments — a patient can move beds.
CREATE TABLE emergency.bed_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id    UUID        NOT NULL REFERENCES emergency.emergency_visits(id),
  bed_id      UUID        NOT NULL REFERENCES emergency.emergency_beds(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID        NOT NULL REFERENCES auth.users(id),
  vacated_at  TIMESTAMPTZ,
  notes       TEXT
);

CREATE INDEX idx_bed_assignments_visit ON emergency.bed_assignments(visit_id);
CREATE INDEX idx_bed_assignments_bed   ON emergency.bed_assignments(bed_id);

-- View: current bed occupancy (active assignments only)
CREATE VIEW emergency.current_bed_occupancy AS
SELECT
  b.id          AS bed_id,
  b.bed_code,
  b.bed_type,
  b.location,
  ba.visit_id,
  ev.patient_id,
  ev.triage_level,
  ev.chief_complaint,
  ba.assigned_at
FROM emergency.emergency_beds b
LEFT JOIN emergency.bed_assignments ba ON ba.bed_id = b.id AND ba.vacated_at IS NULL
LEFT JOIN emergency.emergency_visits ev ON ev.id = ba.visit_id
WHERE b.is_active = TRUE;

-- ── trauma_activations ───────────────────────────────────────
-- Major trauma events that require full team response.
CREATE TABLE emergency.trauma_activations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id         UUID        NOT NULL REFERENCES emergency.emergency_visits(id),
  activation_level VARCHAR(20) NOT NULL DEFAULT 'level_1'
                     CHECK (activation_level IN ('level_1','level_2','level_3')),
  activated_by     UUID        NOT NULL REFERENCES auth.users(id),
  activated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mechanism        TEXT,                    -- 'MVA', 'GSW', 'fall from height'
  team_notified_at TIMESTAMPTZ,
  team_arrived_at  TIMESTAMPTZ,
  outcome          VARCHAR(50),
  notes            TEXT
);

-- Add FK from emr.encounters back to emergency.emergency_visits
ALTER TABLE emr.encounters
  ADD CONSTRAINT fk_encounter_emergency_visit
  FOREIGN KEY (emergency_visit_id) REFERENCES emergency.emergency_visits(id);