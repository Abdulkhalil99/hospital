import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';

export class AuthRepository {
  private db: Pool = getDb();

  async findUserByUsername(username: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM auth.users
       WHERE username = $1 AND is_deleted = FALSE LIMIT 1`,
      [username],
    );
    return rows[0] ?? null;
  }

  async findUserById(id: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM auth.users WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async getUserRoles(userId: string) {
    const { rows } = await this.db.query(
      `SELECT r.id, r.name, r.description
       FROM auth.roles r
       JOIN auth.user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId],
    );
    return rows;
  }

  async getUserPermissions(userId: string) {
    const { rows } = await this.db.query(
      `SELECT DISTINCT p.id, p.code, p.description
       FROM auth.permissions p
       JOIN auth.role_permissions rp ON rp.permission_id = p.id
       JOIN auth.user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1`,
      [userId],
    );
    return rows;
  }

  async incrementFailedAttempts(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ failed_attempts: number }>(
      `UPDATE auth.users
       SET failed_attempts = failed_attempts + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING failed_attempts`,
      [userId],
    );
    return rows[0]?.failed_attempts ?? 1;
  }

  async lockUser(userId: string, until: Date): Promise<void> {
    await this.db.query(
      `UPDATE auth.users
       SET is_locked = TRUE, locked_until = $2, updated_at = NOW()
       WHERE id = $1`,
      [userId, until],
    );
  }

  async resetLoginState(userId: string, ip: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.users
       SET failed_attempts = 0,
           is_locked       = FALSE,
           locked_until    = NULL,
           last_login_at   = NOW(),
           last_login_ip   = $2,
           updated_at      = NOW()
       WHERE id = $1`,
      [userId, ip],
    );
  }

  async saveRefreshToken(
    userId:    string,
    tokenHash: string,
    expiresAt: Date,
    meta:      { ip?: string; userAgent?: string },
  ): Promise<void> {
    const deviceInfo = meta.ip || meta.userAgent
      ? JSON.stringify({
        ...(meta.ip ? { ipAddress: meta.ip } : {}),
        ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
      })
      : null;

    await this.db.query(
      `INSERT INTO auth.refresh_tokens
         (user_id, token_hash, expires_at, device_info)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, tokenHash, expiresAt, deviceInfo],
    );
  }

  async findRefreshToken(tokenHash: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM auth.refresh_tokens WHERE token_hash = $1 LIMIT 1`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async updatePassword(userId: string, newHash: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.users
       SET password_hash = $2, must_change_password = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [userId, newHash],
    );
  }
}
