process.env.JWT_SECRET = 'test_secret_minimum_32_characters_long_xx';

import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from '@/shared/utils/jwt.util';
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

  it('generates a refresh token pair and matching hash', () => {
    const token = signRefreshToken();
    expect(token.raw).toHaveLength(128);
    expect(token.hash).toBe(hashRefreshToken(token.raw));
  });

  it('returns a refresh token expiry date in the future', () => {
    expect(refreshTokenExpiry().getTime()).toBeGreaterThan(Date.now());
  });

});
