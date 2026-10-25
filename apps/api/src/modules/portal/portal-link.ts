import { createHmac } from 'crypto';
import { config } from '@/config';

export const portalCodeDigest = (challengeId: string, code: string) =>
  createHmac('sha256', config.jwt.secret).update(`${challengeId}:${code}`).digest('hex');
