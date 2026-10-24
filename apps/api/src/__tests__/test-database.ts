import { randomBytes } from 'crypto';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://medicore_user:medicore_pass@localhost:5433/medicore_test';

export interface TestDatabaseConfig {
  databaseName: string;
  databaseUrl: string;
  adminUrl: string;
}

export function getTestDatabaseConfig(
  connectionString = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
): TestDatabaseConfig {
  const databaseUrl = new URL(connectionString);
  const baseName = decodeURIComponent(databaseUrl.pathname.slice(1));

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
      baseName.length > 48 ||
      !/^[a-z][a-z0-9_]*_test(?:_[a-z0-9_]+)?$/i.test(baseName)) {
    throw new Error(
      'TEST_DATABASE_URL must use PostgreSQL and a database name such as medicore_test ' +
      '(letters, digits and underscores; at most 48 characters).',
    );
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  // A unique database keeps existing databases and simultaneous test runs safe.
  const databaseName = `${baseName}_${randomBytes(6).toString('hex')}`;
  databaseUrl.pathname = `/${databaseName}`;

  return {
    databaseName,
    databaseUrl: databaseUrl.toString(),
    adminUrl: adminUrl.toString(),
  };
}

export const testDatabaseState = globalThis as typeof globalThis & {
  __medicoreTestDatabase?: TestDatabaseConfig;
};
