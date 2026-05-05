-- ============================================================
-- MIGRATION 020 — Fix default seed passwords
-- Ensures the advertised local dev password matches older seeded users.
-- Only repair rows that still carry the known bad hash.
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
AND password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgBDRFuQNLUiXzLfSlXIeO';
