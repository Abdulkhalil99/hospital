const mockPool = jest.fn().mockImplementation(() => ({ on: jest.fn() }));

jest.mock('pg', () => ({ Pool: mockPool }));
jest.mock('@/infrastructure/logger/logger', () => ({ logger: { error: jest.fn(), debug: jest.fn() } }));

describe('Database TLS configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    mockPool.mockClear();
  });

  it.each([false, true])('uses DB_SSL=%s independently of production mode', (ssl) => {
    jest.doMock('@/config', () => ({
      config: {
        isProd: true,
        db: { url: 'postgresql://localhost/medicore_test', ssl, poolMax: 2, poolIdle: 1000, poolAcquire: 1000 },
      },
    }));
    const { getDb } = require('@/infrastructure/database/db.client');

    expect(getDb()).toBe(getDb());
    expect(mockPool).toHaveBeenCalledTimes(1);
    expect(mockPool).toHaveBeenCalledWith(expect.objectContaining({
      ssl: ssl ? { rejectUnauthorized: true } : false,
    }));
  });
});
