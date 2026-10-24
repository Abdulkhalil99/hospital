const mockDb = { query: jest.fn() };
jest.mock('@/infrastructure/database/db.client', () => ({ getDb: jest.fn(() => mockDb) }));

import { AuthRepository } from '@/modules/auth/auth.repository';

describe('AuthRepository refresh rotation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('consumes an active token and inserts its replacement in a single database statement', async () => {
    const consumed = { user_id: 'user-1', revoked_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [consumed] });
    const expiresAt = new Date('2099-01-01');
    await expect(new AuthRepository().rotateRefreshToken('old-hash', 'new-hash', expiresAt))
      .resolves.toBe(consumed);
    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const [query, values] = mockDb.query.mock.calls[0];
    expect(query).toContain('revoked_at IS NULL AND expires_at > NOW()');
    expect(query).toContain('INSERT INTO auth.refresh_tokens');
    expect(query).toContain('SELECT user_id, $2, $3 FROM consumed');
    expect(values).toEqual(['old-hash', 'new-hash', expiresAt]);
  });

  it('returns no consumed token when it was already used or expired', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await expect(new AuthRepository().rotateRefreshToken('used-hash', 'new-hash', new Date()))
      .resolves.toBeNull();
  });
});
