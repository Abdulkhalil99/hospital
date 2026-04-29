-- ============================================================
-- MIGRATION 006 — Doctors schema
-- Purpose: Doctor profiles, schedules, availability
-- ============================================================

-- ── departments ──────────────────────────────────────────────
CREATE TABLE doctors.departments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL UNIQUE,
  name_fa      VARCHAR(100),               -- Persian name
  name_ps      VARCHAR(100),               -- Pashto name
  description  TEXT,
  floor        VARCHAR(20),
  phone_ext    VARCHAR(10),
  head_doctor_id UUID,                     -- FK added after doctors table exists
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO doctors.departments (name, name_fa) VALUES
  ('General Medicine',  'طب عمومی'),
  ('Emergency',         'اورژانس'),
  ('Surgery',           'جراحی'),
  ('Pediatrics',        'اطفال'),
  ('Gynecology',        'زنان'),
  ('Orthopedics',       'ارتوپدی'),
  ('Cardiology',        'قلب'),
  ('Neurology',         'مغز و اعصاب'),
  ('Dermatology',       'پوست'),
  ('Radiology',         'رادیولوژی'),
  ('Laboratory',        'آزمایشگاه'),
  ('Pharmacy',          'داروخانه');

-- ── specialties ──────────────────────────────────────────────
CREATE TABLE doctors.specialties (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL UNIQUE,
  name_fa      VARCHAR(100),
  name_ps      VARCHAR(100),
  department_id UUID        REFERENCES doctors.departments(id)
);

-- ── doctors ──────────────────────────────────────────────────
-- Doctor profile. user_id links to auth.users for login.
CREATE TABLE doctors.doctors (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL UNIQUE REFERENCES auth.users(id),
  license_number    VARCHAR(50)  NOT NULL UNIQUE,
  specialty_id      UUID         REFERENCES doctors.specialties(id),
  department_id     UUID         REFERENCES doctors.departments(id),
  title             VARCHAR(20)  DEFAULT 'Dr.',     -- 'Dr.', 'Prof.', 'Assoc. Prof.'
  bio               TEXT,
  consultation_fee  NUMERIC(10,2) NOT NULL DEFAULT 0,
  consultation_fee_currency VARCHAR(3) DEFAULT 'AFN',
  license_expires_at DATE,
  is_available      BOOLEAN      NOT NULL DEFAULT TRUE,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by        UUID         REFERENCES auth.users(id),
  is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ
);

ALTER TABLE doctors.departments
  ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_doctor_id) REFERENCES doctors.doctors(id);

CREATE INDEX idx_doctors_specialty   ON doctors.doctors(specialty_id);
CREATE INDEX idx_doctors_department  ON doctors.doctors(department_id);
CREATE INDEX idx_doctors_user        ON doctors.doctors(user_id);

CREATE TRIGGER doctors_updated_at
  BEFORE UPDATE ON doctors.doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── doctor_schedules ─────────────────────────────────────────
-- Weekly recurring schedule template.
-- day_of_week: 0=Sunday, 1=Monday … 6=Saturday
-- The appointment slot engine reads this to compute availability.
CREATE TABLE doctors.doctor_schedules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     UUID        NOT NULL REFERENCES doctors.doctors(id) ON DELETE CASCADE,
  day_of_week   SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME        NOT NULL,
  end_time      TIME        NOT NULL,
  slot_duration INTEGER     NOT NULL DEFAULT 15,   -- minutes per appointment
  max_patients  INTEGER     NOT NULL DEFAULT 20,
  location      VARCHAR(100),                      -- room or clinic name
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  effective_from DATE       NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_doctor_schedules_doctor ON doctors.doctor_schedules(doctor_id) WHERE is_active = TRUE;
CREATE UNIQUE INDEX idx_doctor_schedule_unique
  ON doctors.doctor_schedules(doctor_id, day_of_week, start_time, effective_from)
  WHERE is_active = TRUE;

-- ── doctor_leaves ────────────────────────────────────────────
-- When a doctor is away — blocks their appointment slots.
CREATE TABLE doctors.doctor_leaves (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID        NOT NULL REFERENCES doctors.doctors(id) ON DELETE CASCADE,
  leave_type   VARCHAR(30) NOT NULL DEFAULT 'annual'
                 CHECK (leave_type IN ('annual','sick','conference','emergency','other')),
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  reason       TEXT,
  approved_by  UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_doctor_leaves_doctor ON doctors.doctor_leaves(doctor_id);
CREATE INDEX idx_doctor_leaves_dates  ON doctors.doctor_leaves(start_date, end_date);