import 'dotenv/config';
import fs   from 'fs';
import path from 'path';
import { getDb } from './db.client';
import { logDatabaseConnectionHelp } from './db.diagnostics';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run(): Promise<void> {
  const db = getDb();

  // Track which migrations have run
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.migrations (
      id         SERIAL      PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      run_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows: done } = await db.query('SELECT filename FROM public.migrations');
  const doneSet = new Set(done.map((r: { filename: string }) => r.filename));

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (doneSet.has(file)) { console.log(`⏭  Skipping ${file}`); continue; }

    console.log(`▶  Running ${file}...`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public.migrations(filename) VALUES($1)', [file]);
      await client.query('COMMIT');
      console.log(`✅ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ ${file} failed:`, err);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log('\n✅ All migrations complete');
  process.exit(0);
}

run().catch((err) => {
  logDatabaseConnectionHelp('Migration startup failed.', err);
  process.exit(1);
});
