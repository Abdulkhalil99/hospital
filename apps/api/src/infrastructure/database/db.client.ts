import { Pool, PoolClient } from 'pg';
import { config } from '@/config';
import { logger } from '@/infrastructure/logger/logger';

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:         config.db.url,
      max:                      20,       // max simultaneous connections
      idleTimeoutMillis:        30_000,   // release idle connections after 30s
      connectionTimeoutMillis:  2_000,    // fail fast if DB unreachable
    });

    pool.on('error', (err) => {
      logger.error('Unexpected DB pool error', { error: err.message });
    });
  }
  return pool;
}

// Called once at startup — proves DB is alive before taking traffic
export async function testDbConnection(): Promise<void> {
  const client: PoolClient = await getDb().connect();
  await client.query('SELECT 1');
  client.release();
  logger.info('✅  Database connected');
}