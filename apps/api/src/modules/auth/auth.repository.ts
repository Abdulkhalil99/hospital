import { getDb } from '@/infrastructure/database/db.client';
import { UserRow, RoleRow, PermissionRow } from './auth.types';

export class AuthRepository {
  private db = getDb();

  async findUserByUsername(username: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT id, username, email, password_hash, full_name,
              is_active, is_locked, locked_until,
              failed_attempts, must_change_password, preferred_language
       FROM auth.users
       WHERE username = $1 AND is_deleted = FALSE`,
      [username],
    );
    return rows[0] ?? null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT id, username, email, password_hash, full_name,
              is_active, is_locked, locked_until,
              failed_attempts, must_change_password, preferred_language
       FROM auth.users
       WHERE id = $1 AND is_deleted = FALSE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async getUserRoles(userId: string): Promise<RoleRow[]> {
    const { rows } = await this.db.query<RoleRow>(
      `SELECT r.id, r.name
       FROM auth.user_roles ur
       JOIN auth.roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId],
    );
    return rows;
  }

  async getUserPermissions(userId: string): Promise<PermissionRow[]> {
    const { rows } = await this.db.query<PermissionRow>(
      `SELECT DISTINCT p.code
       FROM auth.user_roles ur
       JOIN auth.role_permissions rp ON rp.role_id = ur.role_id
       JOIN auth.permissions      p  ON p.id       = rp.permission_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId],
    );
    return rows;
  }

  async incrementFailedAttempts(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ failed_attempts: number }>(
      `UPDATE auth.users
       SET failed_attempts = failed_attempts + 1, updated_at = NOW()
       WHERE id = $1 RETURNING failed_attempts`,
      [userId],
    );
    return rows[0].failed_attempts;
  }

  async lockUser(userId: string, until: Date): Promise<void> {
    await this.db.query(
      `UPDATE auth.users
       SET is_locked = TRUE, locked_until = $2,
           failed_attempts = 0, updated_at = NOW()
       WHERE id = $1`,
      [userId, until],
    );
  }

  async resetLoginState(userId: string, ip: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.users
       SET failed_attempts = 0, is_locked = FALSE,
           locked_until = NULL, last_login_at = NOW(),
           last_login_ip = $2, updated_at = NOW()
       WHERE id = $1`,
      [userId, ip],
    );
  }

  async saveRefreshToken(
    userId:     string,
    tokenHash:  string,
    expiresAt:  Date,
    deviceInfo: object,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO auth.refresh_tokens
         (user_id, token_hash, expires_at, device_info)
       VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, expiresAt, JSON.stringify(deviceInfo)],
    );
  }

  async findRefreshToken(tokenHash: string): Promise<{
    id: string; user_id: string;
    expires_at: Date; revoked_at: Date | null;
  } | null> {
    const { rows } = await this.db.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM auth.refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async updatePassword(userId: string, newHash: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.users
       SET password_hash = $2, must_change_password = FALSE,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, newHash],
    );
  }
}
