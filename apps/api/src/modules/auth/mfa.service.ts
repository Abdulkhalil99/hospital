import bcrypt from 'bcrypt';
import { PoolClient } from 'pg';
import { getDb, withTransaction } from '@/infrastructure/database/db.client';
import { AppError, ConflictError, UnauthorizedError } from '@/shared/errors/app-error';
import { AuthRepository } from './auth.repository';
import { decryptSecret, encryptSecret, matchingStep, mfaConfigured, newRecoveryCodes, newSecret, recoveryHash } from './mfa.crypto';

type Credentials = { currentPassword: string; code?: string };
type MfaRow = {
  encrypted_secret: string; enabled: boolean; pending_expires_at: Date | null;
  last_step: string; recovery_hashes: string[]; locked_until: Date | null;
};

export class MfaService {
  private repo = new AuthRepository();

  async status(userId: string) {
    const { rows } = await getDb().query(
      `SELECT u.mfa_enabled AS enabled, COALESCE(cardinality(m.recovery_hashes),0) AS recovery_codes_remaining
       FROM auth.users u LEFT JOIN auth.user_mfa m ON m.user_id=u.id WHERE u.id=$1`, [userId]);
    const events = await getDb().query(
      `SELECT id,event_type,created_at FROM auth.security_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, [userId]);
    return { ...rows[0], configured: mfaConfigured(), events: events.rows };
  }

  private async verifyPassword(userId: string, password: string) {
    const user = await this.repo.findUserById(userId);
    if (!user?.is_active) throw new UnauthorizedError('Account unavailable');
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      throw new AppError('Too many attempts. Try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    }
    if (!await bcrypt.compare(password, user.password_hash)) {
      const attempts = await this.repo.incrementFailedAttempts(userId);
      if (attempts >= 5) await this.repo.lockUser(userId, new Date(Date.now() + 30 * 60 * 1000));
      throw new AppError('Current password is incorrect', 400, 'INVALID_CREDENTIALS');
    }
    return user;
  }

  async enroll(userId: string, currentPassword: string) {
    const user = await this.verifyPassword(userId, currentPassword);
    const secret = newSecret(), encrypted = encryptSecret(secret, userId);
    await withTransaction(async db => {
      await db.query('SELECT id FROM auth.users WHERE id=$1 FOR UPDATE', [userId]);
      const result = await db.query(
        `INSERT INTO auth.user_mfa(user_id,encrypted_secret,pending_expires_at)
         VALUES($1,$2,NOW()+INTERVAL '10 minutes')
         ON CONFLICT(user_id) DO UPDATE SET encrypted_secret=$2,pending_expires_at=NOW()+INTERVAL '10 minutes',
           last_step=-1,recovery_hashes='{}',updated_at=NOW()
         WHERE auth.user_mfa.enabled=FALSE RETURNING user_id`, [userId, encrypted]);
      if (!result.rowCount) throw new ConflictError('Authenticator is already enabled');
    });
    return { secret, uri: `otpauth://totp/${encodeURIComponent(`MediCore:${user.username}`)}?secret=${secret}&issuer=MediCore&algorithm=SHA1&digits=6&period=30`, expiresIn: 600 };
  }

  // Locking the row makes TOTP and recovery-code consumption single-use, including
  // simultaneous login requests. Failed attempts commit before returning an error.
  private async consume<T>(userId: string, code: string, pending: boolean, action: (db: PoolClient, row: MfaRow) => Promise<T>): Promise<T> {
    const outcome = await withTransaction(async db => {
      const { rows } = await db.query<MfaRow>('SELECT * FROM auth.user_mfa WHERE user_id=$1 FOR UPDATE', [userId]);
      const row = rows[0];
      if (!row || row.enabled === pending || (pending && (!row.pending_expires_at || new Date(row.pending_expires_at).getTime() <= Date.now()))) {
        return { error: 'Authenticator setup expired or is unavailable. Start setup again.' };
      }
      if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return { locked: true };
      const step = matchingStep(decryptSecret(row.encrypted_secret, userId), code, Number(row.last_step));
      const hash = recoveryHash(userId, code);
      const recovery = !pending && row.recovery_hashes.includes(hash);
      if (step === null && !recovery) {
        await db.query(
          `UPDATE auth.user_mfa SET failed_attempts=CASE WHEN locked_until<=NOW() THEN 1 ELSE failed_attempts+1 END,
           locked_until=CASE WHEN (CASE WHEN locked_until<=NOW() THEN 1 ELSE failed_attempts+1 END)>=5 THEN NOW()+INTERVAL '15 minutes' ELSE NULL END
           WHERE user_id=$1`, [userId]);
        return { error: 'Invalid or already used authenticator code. Wait for a new code, or use a recovery code.' };
      }
      await db.query(
        `UPDATE auth.user_mfa SET last_step=COALESCE($2,last_step),recovery_hashes=array_remove(recovery_hashes,$3),
         failed_attempts=0,locked_until=NULL,updated_at=NOW() WHERE user_id=$1`, [userId, step, recovery ? hash : '']);
      if (recovery) await this.event(db, userId, 'mfa.recovery_used');
      return { value: await action(db, row) };
    });
    if ('locked' in outcome) throw new AppError('Too many authenticator attempts. Try again in 15 minutes.', 429, 'RATE_LIMIT_EXCEEDED');
    if ('error' in outcome) throw new AppError(outcome.error!, 400, 'INVALID_MFA_CODE');
    return outcome.value;
  }

  private async event(db: PoolClient, userId: string, event: string) {
    await db.query('INSERT INTO auth.security_events(user_id,event_type) VALUES($1,$2)', [userId, event]);
  }

  async verifyLogin(userId: string, code?: string) {
    if (!code) throw new AppError('Enter your authenticator code or a recovery code.', 400, 'MFA_REQUIRED');
    await this.consume(userId, code, false, async () => undefined);
  }

  async confirm(userId: string, credentials: Credentials) {
    await this.verifyPassword(userId, credentials.currentPassword);
    return this.consume(userId, credentials.code ?? '', true, async db => {
      const codes = newRecoveryCodes();
      await db.query('UPDATE auth.user_mfa SET enabled=TRUE,pending_expires_at=NULL,recovery_hashes=$2 WHERE user_id=$1', [userId, codes.map(code => recoveryHash(userId, code))]);
      await db.query('UPDATE auth.users SET mfa_enabled=TRUE WHERE id=$1', [userId]);
      await db.query('UPDATE auth.refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
      await this.event(db, userId, 'mfa.enabled');
      return { recoveryCodes: codes };
    });
  }

  async disable(userId: string, credentials: Credentials) {
    await this.verifyPassword(userId, credentials.currentPassword);
    await this.consume(userId, credentials.code ?? '', false, async db => {
      await db.query('DELETE FROM auth.user_mfa WHERE user_id=$1', [userId]);
      await db.query('UPDATE auth.users SET mfa_enabled=FALSE WHERE id=$1', [userId]);
      await db.query('UPDATE auth.refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
      await this.event(db, userId, 'mfa.disabled');
    });
  }

  async regenerate(userId: string, credentials: Credentials) {
    await this.verifyPassword(userId, credentials.currentPassword);
    return this.consume(userId, credentials.code ?? '', false, async db => {
      const codes = newRecoveryCodes();
      await db.query('UPDATE auth.user_mfa SET recovery_hashes=$2 WHERE user_id=$1', [userId, codes.map(code => recoveryHash(userId, code))]);
      await db.query('UPDATE auth.refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
      await this.event(db, userId, 'mfa.recovery_regenerated');
      return { recoveryCodes: codes };
    });
  }
}
