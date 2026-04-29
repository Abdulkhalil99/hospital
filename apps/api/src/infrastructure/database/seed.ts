import 'dotenv/config';
import { getDb } from './db.client';
import { logDatabaseConnectionHelp } from './db.diagnostics';

const DEFAULT_SUPER_ADMIN_PASSWORD = 'Admin@123456';
// Precomputed bcrypt hash for the default password above. Keeping this inline
// avoids a native bcrypt dependency during local seed runs.
const DEFAULT_SUPER_ADMIN_PASSWORD_HASH =
  '$2b$12$z4um5ZpnGWaeHueIdaou0.mU9YLK1GnzwCOeUVbkfXRCiY7tXc8q2';

async function run(): Promise<void> {
  const db = getDb();

  console.log('🌱 Seeding database...');

  // 1 — Permissions
  const permissions = [
    { code: 'patient:create',   module: 'patients',  desc: 'Create patients' },
    { code: 'patient:read',     module: 'patients',  desc: 'View patients' },
    { code: 'patient:update',   module: 'patients',  desc: 'Edit patients' },
    { code: 'emr:read',         module: 'emr',       desc: 'View EMR records' },
    { code: 'emr:write',        module: 'emr',       desc: 'Write EMR records' },
    { code: 'appointment:create',module:'appointments',desc:'Book appointments'},
    { code: 'appointment:read', module: 'appointments',desc:'View appointments'},
    { code: 'queue:read',       module: 'queue',     desc: 'View queue' },
    { code: 'queue:call_next',  module: 'queue',     desc: 'Call next patient' },
    { code: 'billing:read',     module: 'billing',   desc: 'View billing' },
    { code: 'billing:invoice',  module: 'billing',   desc: 'Create invoices' },
    { code: 'user:manage',      module: 'users',     desc: 'Manage users' },
    { code: 'role:manage',      module: 'users',     desc: 'Manage roles' },
    { code: 'settings:manage',  module: 'settings',  desc: 'Manage settings' },
    { code: 'report:view',      module: 'reports',   desc: 'View reports' },
    { code: 'audit:read',       module: 'audit',     desc: 'View audit logs' },
  ];

  for (const p of permissions) {
    await db.query(`
      INSERT INTO auth.permissions (code, description, module)
      VALUES ($1, $2, $3)
      ON CONFLICT (code) DO NOTHING
    `, [p.code, p.desc, p.module]);
  }
  console.log(`  ✅ ${permissions.length} permissions seeded`);

  // 2 — Roles
  const roles = [
    { name: 'super_admin',   display: 'Super Administrator', isSystem: true },
    { name: 'admin',         display: 'Administrator',       isSystem: true },
    { name: 'doctor',        display: 'Doctor',              isSystem: true },
    { name: 'nurse',         display: 'Nurse',               isSystem: true },
    { name: 'receptionist',  display: 'Receptionist',        isSystem: true },
    { name: 'pharmacist',    display: 'Pharmacist',          isSystem: true },
    { name: 'lab_technician',display: 'Lab Technician',      isSystem: true },
    { name: 'accountant',    display: 'Accountant',          isSystem: true },
    { name: 'radiologist',   display: 'Radiologist',         isSystem: true },
    { name: 'patient',       display: 'Patient',             isSystem: true },
  ];

  for (const r of roles) {
    await db.query(`
      INSERT INTO auth.roles (name, display_name, is_system)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO NOTHING
    `, [r.name, r.display, r.isSystem]);
  }
  console.log(`  ✅ ${roles.length} roles seeded`);

  // 3 — Super admin user
  const { rows } = await db.query(`
    INSERT INTO auth.users (username, email, password_hash, full_name)
    VALUES ('superadmin', 'admin@medicore.local', $1, 'Super Administrator')
    ON CONFLICT (username) DO UPDATE SET updated_at = NOW()
    RETURNING id
  `, [DEFAULT_SUPER_ADMIN_PASSWORD_HASH]);

  const userId = rows[0].id;

  // Assign super_admin role
  const { rows: roleRows } = await db.query(
    `SELECT id FROM auth.roles WHERE name = 'super_admin'`
  );
  if (roleRows.length) {
    await db.query(`
      INSERT INTO auth.user_roles (user_id, role_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [userId, roleRows[0].id]);
  }

  console.log('  ✅ Super admin seeded');
  console.log('     Username: superadmin');
  console.log(`     Password: ${DEFAULT_SUPER_ADMIN_PASSWORD}`);
  console.log('     ⚠️  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION');
  console.log('\n✅ Seeding complete');
  process.exit(0);
}

run().catch((err) => {
  logDatabaseConnectionHelp('Seed startup failed.', err);
  process.exit(1);
});
