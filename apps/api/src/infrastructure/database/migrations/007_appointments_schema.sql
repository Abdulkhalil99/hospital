-- ============================================================
-- MIGRATION 007 — Appointments schema
-- Purpose: Booking, scheduling, check-in, no-show tracking
-- ============================================================

-- ── appointment_types ────────────────────────────────────────
CREATE TABLE appointments.appointment_types (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  name_fa         VARCHAR(100),
  name_ps         VARCHAR(100),
  duration_minutes INTEGER     NOT NULL DEFAULT 15,
  color_hex       VARCHAR(7)   DEFAULT '#3B8BD4',   -- calendar display color
  requires_referral BOOLEAN    NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO appointments.appointment_types (name, name_fa, duration_minutes, color_hex) VALUES
  ('New Patient',      'بیمار جدید',        30, '#185FA5'),
  ('Follow-up',        'ویزیت مجدد',         15, '#0F6E56'),
  ('Emergency',        'اورژانس',            10, '#A32D2D'),
  ('Telemedicine',     'ویزیت از راه دور',   20, '#534AB7'),
  ('Procedure',        'عمل سرپایی',         60, '#854F0B'),
  ('Lab Review',       'بررسی نتایج آزمایش', 10, '#3B6D11');

-- ── appointments ─────────────────────────────────────────────
-- Core booking record.
-- status lifecycle: scheduled → confirmed → checked_in → in_progress
--                  → completed | cancelled | no_show
CREATE TABLE appointments.appointments (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID         NOT NULL REFERENCES patients.patients(id),
  doctor_id            UUID         NOT NULL REFERENCES doctors.doctors(id),
  appointment_type_id  UUID         NOT NULL REFERENCES appointments.appointment_types(id),
  -- Scheduling
  scheduled_date       DATE         NOT NULL,
  scheduled_start      TIME         NOT NULL,
  scheduled_end        TIME         NOT NULL,
  -- Status
  status               VARCHAR(20)  NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN (
                           'scheduled','confirmed','checked_in',
                           'in_progress','completed','cancelled','no_show'
                         )),
  -- Check-in
  checked_in_at        TIMESTAMPTZ,
  checked_in_by        UUID         REFERENCES auth.users(id),
  -- Completion
  completed_at         TIMESTAMPTZ,
  -- Cancellation
  cancelled_at         TIMESTAMPTZ,
  cancellation_reason  TEXT,
  cancelled_by         UUID         REFERENCES auth.users(id),
  -- Admin
  notes                TEXT,                          -- receptionist notes
  is_walk_in           BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Base audit
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by           UUID         NOT NULL REFERENCES auth.users(id),
  updated_by           UUID         REFERENCES auth.users(id),
  is_deleted           BOOLEAN      NOT NULL DEFAULT FALSE,
  deleted_at           TIMESTAMPTZ,
  CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_appt_patient       ON appointments.appointments(patient_id);
CREATE INDEX idx_appt_doctor_date   ON appointments.appointments(doctor_id, scheduled_date);
CREATE INDEX idx_appt_date_status   ON appointments.appointments(scheduled_date, status)
  WHERE is_deleted = FALSE;
CREATE INDEX idx_appt_status        ON appointments.appointments(status) WHERE is_deleted = FALSE;

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments.appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER appointments_audit
  AFTER INSERT OR UPDATE OR DELETE ON appointments.appointments
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

-- ── waiting_list ─────────────────────────────────────────────
-- Patients who want an appointment when one becomes available.
CREATE TABLE appointments.waiting_list (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES patients.patients(id),
  doctor_id    UUID        REFERENCES doctors.doctors(id),
  specialty_id UUID        REFERENCES doctors.specialties(id),
  requested_by UUID        NOT NULL REFERENCES auth.users(id),
  priority     SMALLINT    NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  notes        TEXT,
  booked_appointment_id UUID REFERENCES appointments.appointments(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       VARCHAR(20) NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting','offered','booked','cancelled'))
);

-- ── no_shows ─────────────────────────────────────────────────
-- Tracks missed appointments — used for analytics and patient flags.
CREATE TABLE appointments.no_shows (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID        NOT NULL REFERENCES appointments.appointments(id),
  patient_id     UUID        NOT NULL REFERENCES patients.patients(id),
  recorded_by    UUID        NOT NULL REFERENCES auth.users(id),
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contact_attempted BOOLEAN  NOT NULL DEFAULT FALSE,
  rescheduled    BOOLEAN     NOT NULL DEFAULT FALSE,
  notes          TEXT
);

CREATE INDEX idx_no_shows_patient ON appointments.no_shows(patient_id);

-- ── queue_tokens ─────────────────────────────────────────────
-- Created when a patient checks in. Drives the waiting room display.
CREATE TABLE appointments.queue_tokens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID        NOT NULL REFERENCES appointments.appointments(id),
  patient_id     UUID        NOT NULL REFERENCES patients.patients(id),
  doctor_id      UUID        NOT NULL REFERENCES doctors.doctors(id),
  token_number   INTEGER     NOT NULL,        -- display number (1, 2, 3…)
  token_display  VARCHAR(10) NOT NULL,        -- 'A-001' format
  queue_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'waiting'
                   CHECK (status IN ('waiting','called','in_room','completed','skipped')),
  priority       SMALLINT    NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  called_at      TIMESTAMPTZ,
  entered_room_at TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  wait_minutes   INTEGER,                     -- computed on completion
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, queue_date, token_number)
);

CREATE INDEX idx_queue_doctor_date ON appointments.queue_tokens(doctor_id, queue_date, status);
CREATE INDEX idx_queue_patient     ON appointments.queue_tokens(patient_id);