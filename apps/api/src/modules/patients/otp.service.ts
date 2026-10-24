import crypto   from 'crypto';
import bcrypt   from 'bcrypt';
import { PatientsRepository } from './patients.repository';
import { ConflictError, ValidationError } from '@/shared/errors/app-error';
import { logger } from '@/infrastructure/logger/logger';
import { sendSms } from '@/modules/notifications/channels/sms.channel';
import { sendEmail } from '@/modules/notifications/channels/email.channel';

const OTP_EXPIRY_MINUTES = 10;
const MAX_PER_DAY        = 5;
const COOLDOWN_SECONDS   = 60;

export class OtpService {
  private repo = new PatientsRepository();

  async send(
    target:    string,
    type:      'phone' | 'email',
    purpose:   string,
    patientId?: string,
  ): Promise<{ otpId: string; expiresAt: Date }> {
    // Rate limit: max 5 OTPs per target per day
    const todayCount = await this.repo.countOtpsSentToday(target);
    if (todayCount >= MAX_PER_DAY) {
      throw new ConflictError('Maximum OTP attempts reached for today. Try again tomorrow.');
    }

    // Check cooldown: don't allow resend within 60 seconds
    const existing = await this.repo.findLatestOtp(target, purpose);
    if (existing) {
      const secondsAgo = (Date.now() - new Date(existing.created_at).getTime()) / 1000;
      if (secondsAgo < COOLDOWN_SECONDS) {
        const wait = Math.ceil(COOLDOWN_SECONDS - secondsAgo);
        throw new ConflictError(`Please wait ${wait} seconds before requesting a new code.`);
      }
    }

    // Generate a 6-digit code
    const code    = String(crypto.randomInt(100000, 999999));
    const hash    = await bcrypt.hash(code, 10);
    const expiry  = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const otpId   = await this.repo.saveOtp(target, type, hash, purpose, expiry, patientId);

    // In development, log the code — in production, send via SMS/email
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`OTP CODE (dev only): ${code}`, { target, purpose });
    } else {
      const delivered = await this.deliverOtp(target, type, code);
      if (!delivered) {
        await this.repo.markOtpUsed(otpId);
        throw new ConflictError('Unable to deliver the verification code. Please try again later.');
      }
    }

    logger.info('OTP sent', { target: target.replace(/./g, (c, i) => i < 3 ? c : '*'), purpose });
    return { otpId, expiresAt: expiry };
  }

  async verify(
    target:  string,
    code:    string,
    purpose: string,
    patientId?: string,
  ): Promise<boolean> {
    const otpRecord = await this.repo.findLatestOtp(target, purpose, patientId);

    if (!otpRecord) {
      throw new ValidationError([{ message: 'No active OTP found. Please request a new one.' }]);
    }

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      throw new ValidationError([{ message: 'Too many failed attempts. Please request a new code.' }]);
    }

    const valid = await bcrypt.compare(code, otpRecord.code_hash);

    if (!valid) {
      const attempts = await this.repo.incrementOtpAttempts(otpRecord.id);
      const remaining = otpRecord.max_attempts - attempts;
      throw new ValidationError([{
        message: `Invalid code. ${remaining} attempt(s) remaining.`,
      }]);
    }

    await this.repo.markOtpUsed(otpRecord.id);
    return true;
  }

  private async deliverOtp(
    target: string, type: 'phone' | 'email', code: string,
  ): Promise<boolean> {
    const result = type === 'phone'
      ? await sendSms(target, `MediCore verification code: ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`)
      : await sendEmail(
        target,
        'MediCore verification code',
        `Your MediCore verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      );
    if (!result.success) {
      logger.error('OTP delivery failed', { type, error: result.error });
    }
    return result.success;
  }
}
