import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { AppError } from '@/shared/errors/app-error';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Buffer): string {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; output += ALPHABET[(value >>> bits) & 31]; }
  }
  if (bits) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(secret: string): Buffer {
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid authenticator secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) { bits -= 8; output.push((value >>> bits) & 255); }
  }
  return Buffer.from(output);
}

// RFC 6238, 30-second period; SHA-1 is the broadly supported authenticator profile.
export function totpAt(secret: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(number % (10 ** digits)).padStart(digits, '0');
}

export function matchingStep(secret: string, code: string, lastStep: number, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) {
    if (step >= 0 && step > lastStep && timingSafeEqual(Buffer.from(totpAt(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

export function mfaConfigured(): boolean { return /^[0-9a-f]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY ?? ''); }

function encryptionKey(): Buffer {
  if (!mfaConfigured()) throw new AppError('Authenticator service needs its encryption key configured.', 503, 'MFA_NOT_CONFIGURED');
  return Buffer.from(process.env.MFA_ENCRYPTION_KEY!, 'hex');
}

export function encryptSecret(secret: string, userId: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64')).join('.');
}

export function decryptSecret(encrypted: string, userId: string): string {
  const [iv, tag, ciphertext] = encrypted.split('.').map(value => Buffer.from(value, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function newSecret(): string { return base32Encode(randomBytes(20)); }
export function recoveryHash(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code.replace(/[-\s]/g, '').toLowerCase()}`).digest('hex');
}
export function newRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => randomBytes(16).toString('hex').match(/.{8}/g)!.join('-'));
}
