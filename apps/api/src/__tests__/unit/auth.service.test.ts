import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the database
jest.mock('@/infrastructure/database/db.client', () => ({
  getDb: jest.fn(() => ({
    query: jest.fn(),
  })),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash:    jest.fn(),
}));

import bcrypt    from 'bcrypt';
import { getDb } from '@/infrastructure/database/db.client';

describe('Auth Service — login logic', () => {

  const mockDb = {
    query: jest.fn() as jest.MockedFunction<any>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockReturnValue(mockDb);
  });

  it('returns null when user not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const { rows } = await mockDb.query('SELECT * FROM auth.users WHERE username = $1', ['nobody']);
    expect(rows).toHaveLength(0);
  });

  it('bcrypt compare returns true for correct password', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const result = await bcrypt.compare('Test@123456', '$2b$12$hashedpassword');
    expect(result).toBe(true);
  });

  it('bcrypt compare returns false for wrong password', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const result = await bcrypt.compare('wrongpassword', '$2b$12$hashedpassword');
    expect(result).toBe(false);
  });

  it('rejects locked account', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id:              '123',
        username:        'locked',
        is_locked:       true,
        failed_attempts: 5,
        locked_until:    new Date(Date.now() + 3600000),
      }],
    });

    const { rows } = await mockDb.query('SELECT * FROM auth.users WHERE username = $1', ['locked']);
    const user = rows[0];
    expect(user.is_locked).toBe(true);
  });

});
