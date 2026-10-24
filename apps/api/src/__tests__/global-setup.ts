import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { getTestDatabaseConfig, testDatabaseState } from './test-database';

export default async function globalSetup() {
  const database = getTestDatabaseConfig();

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.JWT_SECRET = 'test_secret_minimum_32_characters_long';
  process.env.CORS_ORIGINS = 'http://localhost:3001';
  process.env.DB_SSL = 'false';

  const admin = new Pool({ connectionString: database.adminUrl });
  const pool = new Pool({ connectionString: database.databaseUrl });
  let created = false;
  let initialized = false;

  try {
    // No existing database is dropped or cloned, including the configured base.
    await admin.query(`CREATE DATABASE "${database.databaseName}" TEMPLATE template0`);
    created = true;

    const migrationsDir = path.join(__dirname, '../infrastructure/database/migrations');
    const files = (await fs.readdir(migrationsDir)).filter(file => file.endsWith('.sql')).sort();
    const client = await pool.connect();
    try {
      await client.query(`CREATE TABLE public.migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

      for (const file of files) {
        await client.query('BEGIN');
        try {
          await client.query(await fs.readFile(path.join(migrationsDir, file), 'utf8'));
          await client.query('INSERT INTO public.migrations(filename) VALUES($1)', [file]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw new Error(`Test database migration failed: ${file}`, { cause: error });
        }
      }
    } finally {
      client.release();
    }

    initialized = true;
    testDatabaseState.__medicoreTestDatabase = database;
    console.log(`✅ Isolated test database created and ${files.length} migrations applied`);
  } finally {
    try {
      await pool.end();
      if (created && !initialized) {
        await admin.query(`DROP DATABASE "${database.databaseName}" WITH (FORCE)`);
      }
    } finally {
      await admin.end();
    }
  }
}
