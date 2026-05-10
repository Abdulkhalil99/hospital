import jwt    from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '@/config';
import { UnauthorizedError } from '@/shared/errors/app-error';

export interface JwtPayload {
  sub:         string;
  username:    string;
  roles:       string[];
  permissions: string[];
  iat?:        number;
  exp?:        number;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn as any,
    algorithm: 'HS256',
  });
}

// Returns { raw, hash } — raw is sent to client, hash is stored in DB
export function signRefreshToken(): { raw: string; hash: string } {
  const raw  = crypto.randomBytes(64).toString('hex');
  const hash = hashRefreshToken(raw);
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function refreshTokenExpiry(): Date {
  // 7 days from now
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as JwtPayload;
  } catch (err) {
    if ((err as Error).name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

export function verifyRefreshToken(token: string): { sub: string } {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as { sub: string; type: string };
    if (payload.type !== 'refresh') throw new UnauthorizedError('Invalid token type');
    return payload;
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
}
