import { describe, it, expect, beforeAll } from '@jest/globals';

process.env.JWT_SECRET = 'test_secret_minimum_32_characters_long_xx';

import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '@/shared/utils/jwt.util';
import { UnauthorizedError } from '@/shared/errors/app-error';

describe('JWT utilities', () => {

  const payload = {
    sub:         'user-123',
    username:    'testuser',
    roles:       ['doctor'],
    permissions: ['emr:read', 'emr:write'],
  };

  it('signs and verifies an access token', () => {
    const token    = signAccessToken(payload);
    const verified = verifyAccessToken(token);

    expect(verified.sub).toBe(payload.sub);
    expect(verified.username).toBe(payload.username);
    expect(verified.roles).toEqual(payload.roles);
    expect(verified.permissions).toEqual(payload.permissions);
  });

  it('throws UnauthorizedError for invalid token', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for tampered token', () => {
    const token   = signAccessToken(payload);
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(() => verifyAccessToken(tampered)).toThrow(UnauthorizedError);
  });

  it('signs and verifies a refresh token', () => {
    const token    = signRefreshToken('user-123');
    const verified = verifyRefreshToken(token);
    expect(verified.sub).toBe('user-123');
  });

  it('throws for invalid refresh token', () => {
    expect(() => verifyRefreshToken('bad.token')).toThrow(UnauthorizedError);
  });

});
