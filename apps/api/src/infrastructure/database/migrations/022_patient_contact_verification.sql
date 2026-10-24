-- Persist verification state so downstream workflows can distinguish a
-- confirmed contact from data entered during registration.
ALTER TABLE patients.patients
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_patients_unverified_phone
  ON patients.patients(created_at)
  WHERE phone_verified_at IS NULL AND is_deleted = FALSE;
