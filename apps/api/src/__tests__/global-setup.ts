import { Pool } from 'pg';

const TEST_DB_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://medicore_user:medicore_pass@localhost:5433/medicore_test';

export default async function globalSetup() {
  process.env.NODE_ENV          = 'test';
  process.env.DATABASE_URL      = TEST_DB_URL;
  process.env.JWT_SECRET        = 'test_secret_minimum_32_characters_long';
  process.env.CORS_ORIGINS      = 'http://localhost:3001';

  // Create test database
  const pool = new Pool({
    connectionString: 'postgresql://medicore_user:medicore_pass@localhost:5433/postgres',
  });

  try {
    await pool.query(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = 'medicore_test' AND pid <> pg_backend_pid()
    `);
    await pool.query(`DROP DATABASE IF EXISTS medicore_test`);
    await pool.query(`CREATE DATABASE medicore_test TEMPLATE medicore_db`);
    console.log('✅ Test database created from template');
  } finally {
    await pool.end();
  }
}
