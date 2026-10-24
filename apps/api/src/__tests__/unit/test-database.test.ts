import { getTestDatabaseConfig } from '../test-database';

describe('integration database isolation', () => {
  it.each(['medicore_db', 'postgres', 'production', 'medicore_test;DROP DATABASE postgres'])
    ('rejects unsafe database name %s before connecting', name => {
      expect(() => getTestDatabaseConfig(`postgresql://user:password@localhost:5432/${name}`))
        .toThrow('TEST_DATABASE_URL');
    });

  it('keeps the configured server and credentials for administrative connections', () => {
    const database = getTestDatabaseConfig(
      'postgresql://ci_user:secret@db.example:6543/project_test_ci?sslmode=require',
    );
    const adminUrl = new URL(database.adminUrl);
    expect(adminUrl.hostname).toBe('db.example');
    expect(adminUrl.port).toBe('6543');
    expect(adminUrl.username).toBe('ci_user');
    expect(adminUrl.password).toBe('secret');
    expect(adminUrl.pathname).toBe('/postgres');
    expect(adminUrl.searchParams.get('sslmode')).toBe('require');
  });

  it('creates a different database for each run without targeting the configured base', () => {
    const url = 'postgresql://user:password@localhost:5432/medicore_test';
    const first = getTestDatabaseConfig(url);
    const second = getTestDatabaseConfig(url);
    expect(first.databaseName).toMatch(/^medicore_test_[a-f0-9]{12}$/);
    expect(second.databaseName).not.toBe(first.databaseName);
    expect(new URL(first.databaseUrl).pathname).toBe(`/${first.databaseName}`);
  });

  it('rejects non-PostgreSQL URLs and overlong identifiers', () => {
    expect(() => getTestDatabaseConfig('https://db.example/medicore_test')).toThrow();
    expect(() => getTestDatabaseConfig(`postgresql://localhost/${'a'.repeat(49)}_test`)).toThrow();
  });
});
