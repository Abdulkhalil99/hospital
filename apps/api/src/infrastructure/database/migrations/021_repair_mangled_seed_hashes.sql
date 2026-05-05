-- ============================================================
-- MIGRATION 021 — Repair mangled seed hashes
-- Some local databases contain shortened hashes that cannot be
-- verified by bcrypt. Repair only the known seeded accounts and
-- leave any valid custom password hashes untouched.
-- ============================================================

UPDATE auth.users
SET
  password_hash = '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2',
  must_change_password = TRUE,
  updated_at = NOW()
WHERE username IN (
  'superadmin',
  'admin1',
  'dr.ahmad',
  'nurse.sara',
  'reception1',
  'pharmacist1',
  'labtech1',
  'accountant1'
)
AND (
  password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgBDRFuQNLUiXzLfSlXIeO'
  OR password_hash NOT LIKE '$2%'
  OR length(password_hash) <> 60
);
