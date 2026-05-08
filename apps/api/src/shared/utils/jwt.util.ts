import jwt from 'jsonwebtoken';
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
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
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
