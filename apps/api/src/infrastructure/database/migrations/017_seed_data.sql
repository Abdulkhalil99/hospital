-- ============================================================
-- MIGRATION 017 — Seed data
-- ============================================================

UPDATE settings.hospital_settings SET
  hospital_name    = 'MediCore General Hospital',
  hospital_name_fa = 'بیمارستان عمومی مدیکور',
  hospital_name_ps = 'د مدیکور عمومي روغتون',
  address          = '123 Main Street, Kabul, Afghanistan',
  phone            = '+93-20-000-0000',
  email            = 'info@medicore.local',
  default_language = 'fa',
  default_currency = 'AFN',
  timezone         = 'Asia/Kabul';

-- Users (password hash = 'Admin@123456' for all — CHANGE IN PRODUCTION)
INSERT INTO auth.users
  (username, email, password_hash, full_name, preferred_language, must_change_password)
VALUES
  ('superadmin',  'superadmin@medicore.local',  '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2', 'Super Administrator',    'en', TRUE),
  ('admin1',      'admin@medicore.local',       '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2', 'Hospital Administrator', 'fa', TRUE),
  ('dr.ahmad',    'dr.ahmad@medicore.local',    '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2', 'Dr. Ahmad Karimi',       'fa', TRUE),
  ('nurse.sara',  'nurse.sara@medicore.local',  '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2', 'Sara Mohammadi',         'fa', TRUE),
  ('reception1',  'reception@medicore.local',   '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2', 'Ali Hosseini',           'fa', TRUE),
  ('pharmacist1', 'pharmacy@medicore.local',    '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2', 'Zahra Ahmadi',           'fa', TRUE),
  ('labtech1',    'lab@medicore.local',         '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2', 'Reza Tehrani',           'fa', TRUE),
  ('accountant1', 'accounts@medicore.local',    '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2', 'Maryam Nazari',          'fa', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Assign roles using plain INSERT ... SELECT (no PROCEDURE)
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'superadmin' AND r.name = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'admin1' AND r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'dr.ahmad' AND r.name = 'doctor'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'nurse.sara' AND r.name = 'nurse'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'reception1' AND r.name = 'receptionist'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'pharmacist1' AND r.name = 'pharmacist'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'labtech1' AND r.name = 'lab_technician'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'accountant1' AND r.name = 'accountant'
ON CONFLICT DO NOTHING;

-- Default notification preferences for all users
DO $$
DECLARE v_user_id UUID;
BEGIN
  FOR v_user_id IN SELECT id FROM auth.users WHERE is_deleted = FALSE LOOP
    PERFORM create_default_notification_preferences(v_user_id);
  END LOOP;
END $$;

-- Doctor specialties
INSERT INTO doctors.specialties (name, name_fa, department_id)
SELECT s.name, s.name_fa,
  (SELECT id FROM doctors.departments WHERE name = s.dept LIMIT 1)
FROM (VALUES
  ('General Practice',   'طب عمومی',    'General Medicine'),
  ('Internal Medicine',  'داخلی',       'General Medicine'),
  ('Emergency Medicine', 'طب اورژانس',  'Emergency'),
  ('General Surgery',    'جراحی عمومی', 'Surgery'),
  ('Pediatrics',         'اطفال',       'Pediatrics')
) AS s(name, name_fa, dept)
ON CONFLICT (name) DO NOTHING;

-- Doctor profile for dr.ahmad
INSERT INTO doctors.doctors
  (user_id, license_number, specialty_id, department_id, title, consultation_fee, is_available)
SELECT
  u.id, 'LIC-2024-001',
  (SELECT id FROM doctors.specialties WHERE name = 'General Practice' LIMIT 1),
  (SELECT id FROM doctors.departments WHERE name = 'General Medicine' LIMIT 1),
  'Dr.', 300.00, TRUE
FROM auth.users u WHERE u.username = 'dr.ahmad'
ON CONFLICT (user_id) DO NOTHING;

-- Doctor weekly schedule (Sunday to Friday)
INSERT INTO doctors.doctor_schedules
  (doctor_id, day_of_week, start_time, end_time, slot_duration)
SELECT d.id, day_num, '08:00'::TIME, '17:00'::TIME, 15
FROM doctors.doctors d
JOIN auth.users u ON u.id = d.user_id AND u.username = 'dr.ahmad'
CROSS JOIN generate_series(0, 5) AS day_num
ON CONFLICT DO NOTHING;

-- Sample patients
INSERT INTO patients.patients
  (mrn, first_name, last_name, date_of_birth, gender,
   blood_type, phone, preferred_language, created_by)
SELECT
  settings.next_sequence('mrn'),
  p.fn, p.ln, p.dob::DATE, p.gen, p.bt, p.ph, 'fa',
  (SELECT id FROM auth.users WHERE username = 'superadmin' LIMIT 1)
FROM (VALUES
  ('Ahmad',  'Karimi',   '1985-03-15', 'male',   'A+',      '0700000001'),
  ('Fatima', 'Ahmadi',   '1990-07-22', 'female', 'O+',      '0700000002'),
  ('Hassan', 'Mohammadi','1975-11-08', 'male',   'B+',      '0700000003'),
  ('Zainab', 'Hussaini', '2005-01-30', 'female', 'AB+',     '0700000004'),
  ('Omar',   'Rahmani',  '1965-06-12', 'male',   'O-',      '0700000005')
) AS p(fn, ln, dob, gen, bt, ph)
ON CONFLICT (mrn) DO NOTHING;

-- Allergy for patient Ahmad Karimi
INSERT INTO patients.allergies
  (patient_id, allergen, reaction, severity, recorded_by)
SELECT
  p.id,
  'Penicillin',
  'Anaphylaxis — severe rash and throat swelling',
  'life_threatening',
  (SELECT id FROM auth.users WHERE username = 'dr.ahmad' LIMIT 1)
FROM patients.patients p
WHERE p.first_name = 'Ahmad' AND p.last_name = 'Karimi'
LIMIT 1;

-- Drug catalog
INSERT INTO pharmacy.drugs
  (generic_name, brand_names, drug_class, dosage_form, strength, unit, requires_prescription)
VALUES
  ('Amoxicillin', ARRAY['Amoxil'],     'Antibiotic',    'capsule', '500mg',      'capsule', TRUE),
  ('Paracetamol', ARRAY['Panadol'],    'Analgesic',     'tablet',  '500mg',      'tablet',  FALSE),
  ('Ibuprofen',   ARRAY['Brufen'],     'NSAID',         'tablet',  '400mg',      'tablet',  FALSE),
  ('Omeprazole',  ARRAY['Losec'],      'PPI',           'capsule', '20mg',       'capsule', TRUE),
  ('Metformin',   ARRAY['Glucophage'], 'Antidiabetic',  'tablet',  '500mg',      'tablet',  TRUE),
  ('Salbutamol',  ARRAY['Ventolin'],   'Bronchodilator','inhaler', '100mcg/dose','inhaler', TRUE),
  ('ORS',         ARRAY['Pedialyte'],  'Electrolyte',   'sachet',  '1g',         'sachet',  FALSE)
ON CONFLICT DO NOTHING;

-- Initial drug inventory
INSERT INTO pharmacy.drug_inventory
  (drug_id, location, quantity_on_hand, reorder_level, selling_price)
SELECT id, 'main_pharmacy',
  CASE dosage_form
    WHEN 'tablet'  THEN 1000
    WHEN 'capsule' THEN 500
    WHEN 'inhaler' THEN 50
    ELSE 200
  END,
  50, 30
FROM pharmacy.drugs
ON CONFLICT DO NOTHING;

-- Lab test catalog
INSERT INTO laboratory.lab_tests
  (code, name, name_fa, category, sample_type, turnaround_hours, price)
VALUES
  ('CBC',       'Complete Blood Count',       'شمارش کامل خون',    'Hematology',   'blood', 2,  150),
  ('LFT',       'Liver Function Tests',       'آزمایش کارکرد کبد', 'Biochemistry', 'blood', 4,  300),
  ('FBS',       'Fasting Blood Sugar',        'قند خون ناشتا',     'Biochemistry', 'blood', 1,  100),
  ('TSH',       'Thyroid Stimulating Hormone','هورمون محرک تیروئید','Endocrinology','blood', 24, 350),
  ('URINALYSIS','Urinalysis',                 'آزمایش ادرار',      'Microbiology', 'urine', 2,  120),
  ('PREG',      'Pregnancy Test',             'آزمایش بارداری',    'Immunology',   'urine', 1,  80)
ON CONFLICT (code) DO NOTHING;

-- Reference ranges
INSERT INTO laboratory.reference_ranges
  (lab_test_id, component_name, unit, gender, normal_min, normal_max, critical_low, critical_high)
SELECT id, 'Haemoglobin', 'g/dL', 'male', 13.5, 17.5, 7.0, 20.0
FROM laboratory.lab_tests WHERE code = 'CBC';

INSERT INTO laboratory.reference_ranges
  (lab_test_id, component_name, unit, gender, normal_min, normal_max, critical_low, critical_high)
SELECT id, 'Haemoglobin', 'g/dL', 'female', 12.0, 16.0, 7.0, 20.0
FROM laboratory.lab_tests WHERE code = 'CBC';

INSERT INTO laboratory.reference_ranges
  (lab_test_id, component_name, unit, gender, normal_min, normal_max, critical_low, critical_high)
SELECT id, 'Fasting Glucose', 'mg/dL', 'all', 70, 100, 50, 500
FROM laboratory.lab_tests WHERE code = 'FBS';

DO $$
BEGIN
  RAISE NOTICE '✅ MediCore seed complete';
  RAISE NOTICE 'Login: superadmin / Admin@123456';
  RAISE NOTICE '⚠️  Change all passwords before production use';
END $$;
