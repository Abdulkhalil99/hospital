import jwt  from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '@/config';

export interface TokenPayload {
  sub:         string;
  username:    string;
  roles:       string[];
  permissions: string[];
  iat?:        number;
  exp?:        number;
}

export function signAccessToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
}

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw  = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function refreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}
