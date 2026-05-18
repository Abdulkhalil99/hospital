const mockDb = {
  query: jest.fn() as jest.MockedFunction<any>,
};

jest.mock('@/infrastructure/database/db.client', () => ({
  getDb: jest.fn(() => mockDb),
}));

import { AuthRepository } from '@/modules/auth/auth.repository';

describe('AuthRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores refresh token metadata in device_info', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const repo = new AuthRepository();
    await repo.saveRefreshToken(
      'user-1',
      'token-hash',
      new Date('2026-01-01T00:00:00.000Z'),
      { ip: '127.0.0.1', userAgent: 'test-agent' },
    );

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('(user_id, token_hash, expires_at, device_info)'),
      [
        'user-1',
        'token-hash',
        new Date('2026-01-01T00:00:00.000Z'),
        JSON.stringify({ ipAddress: '127.0.0.1', userAgent: 'test-agent' }),
      ],
    );
  });
});
