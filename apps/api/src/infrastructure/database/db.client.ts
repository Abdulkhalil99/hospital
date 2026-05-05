import { Pool, PoolClient } from 'pg';
import { config }           from '@/config';
import { logger }           from '@/infrastructure/logger/logger';

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.db.url,
      max:              config.db.poolMax,
      idleTimeoutMillis:config.db.poolIdle,
      connectionTimeoutMillis: config.db.poolAcquire,
      ssl: config.isProd ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { message: err.message });
    });

    pool.on('connect', () => {
      logger.debug('PostgreSQL new connection');
    });
  }
  return pool;
}

export async function testDbConnection(): Promise<void> {
  const db = getDb();
  const client: PoolClient = await db.connect();
  try {
    await client.query('SELECT 1');
    logger.info('✅  Database connected');
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const db     = getDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
