import { getDb } from '@/infrastructure/database/db.client';

// Clean tables between tests in the right order
export async function cleanDatabase() {
  const db = getDb();
  await db.query(`
    TRUNCATE
      billing.payments,
      billing.invoice_items,
      billing.invoices,
      pharmacy.dispensing_records,
      pharmacy.stock_movements,
      laboratory.critical_value_alerts,
      laboratory.lab_results,
      laboratory.lab_samples,
      emr.lab_orders,
      emr.prescriptions,
      emr.diagnoses,
      emr.vital_signs,
      emr.clinical_notes,
      emr.encounters,
      appointments.queue_tokens,
      appointments.appointments,
      patients.allergies,
      patients.patients,
      auth.user_roles,
      auth.users
    RESTART IDENTITY CASCADE
  `);
}

// Seed a test user
export async function seedTestUser(role = 'super_admin') {
  const db   = getDb();
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('Test@123456', 10);

  const { rows: [user] } = await db.query(
    `INSERT INTO auth.users (username, email, password_hash, full_name, preferred_language)
     VALUES ('testuser', 'test@test.com', $1, 'Test User', 'en')
     RETURNING *`,
    [hash],
  );

  const { rows: [roleRow] } = await db.query(
    `SELECT id FROM auth.roles WHERE name = $1`,
    [role],
  );

  if (roleRow) {
    await db.query(
      `INSERT INTO auth.user_roles (user_id, role_id, assigned_by)
       VALUES ($1, $2, $1)`,
      [user.id, roleRow.id],
    );
  }

  return user;
}

// Seed a test patient
export async function seedTestPatient(userId: string) {
  const db = getDb();
  const { rows: [patient] } = await db.query(
    `INSERT INTO patients.patients
       (first_name, last_name, date_of_birth, gender, phone, mrn, created_by)
     VALUES ('Ahmad', 'Test', '1990-01-01', 'male', '0700000000',
             'TEST-001', $1)
     RETURNING *`,
    [userId],
  );
  return patient;
}

// Seed a test doctor
export async function seedTestDoctor(userId: string, createdBy: string) {
  const db = getDb();
  const { rows: [doctor] } = await db.query(
    `INSERT INTO doctors.doctors
       (user_id, license_number, title, consultation_fee, created_by)
     VALUES ($1, 'LIC-TEST-001', 'Dr.', 300, $2)
     RETURNING *`,
    [userId, createdBy],
  );
  return doctor;
}

// Get auth token for testing
export async function getTestToken(userId: string, roles: string[] = ['super_admin'], permissions: string[] = []) {
  const { signAccessToken } = require('@/shared/utils/jwt.util');
  return signAccessToken({
    sub:         userId,
    username:    'testuser',
    roles,
    permissions: permissions.length > 0 ? permissions : ['*'],
  });
}
