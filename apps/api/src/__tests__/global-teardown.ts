import { Pool } from 'pg';

export default async function globalTeardown() {
  const pool = new Pool({
    connectionString: 'postgresql://medicore_user:medicore_pass@localhost:5433/postgres',
  });
  try {
    await pool.query(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = 'medicore_test' AND pid <> pg_backend_pid()
    `);
    await pool.query(`DROP DATABASE IF EXISTS medicore_test`);
    console.log('✅ Test database dropped');
  } finally {
    await pool.end();
  }
}
