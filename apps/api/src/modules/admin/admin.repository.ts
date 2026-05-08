import { getDb } from '@/infrastructure/database/db.client';

export class AdminRepository {
  private db = getDb();

  // ── Users ─────────────────────────────────────────────────
  async listUsers(q = '', limit = 50, offset = 0) {
    const { rows } = await this.db.query(
      `SELECT
         u.id, u.username, u.email, u.full_name,
         u.is_active, u.is_locked, u.failed_attempts,
         u.last_login_at, u.last_login_ip,
         u.must_change_password, u.preferred_language,
         u.created_at,
         ARRAY_AGG(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
       FROM auth.users u
       LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
       LEFT JOIN auth.roles       r  ON r.id = ur.role_id
       WHERE u.is_deleted = FALSE
         AND ($1 = '' OR u.username ILIKE $2
              OR u.email ILIKE $2
              OR u.full_name ILIKE $2)
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $3 OFFSET $4`,
      [q, `%${q}%`, limit, offset],
    );
    return rows;
  }

  async countUsers(q = '') {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM auth.users
       WHERE is_deleted = FALSE
         AND ($1 = '' OR username ILIKE $2 OR email ILIKE $2 OR full_name ILIKE $2)`,
      [q, `%${q}%`],
    );
    return Number(rows[0].count);
  }

  async getUserById(id: string) {
    const { rows } = await this.db.query(
      `SELECT
         u.*,
         ARRAY_AGG(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
         ARRAY_AGG(r.id   ORDER BY r.name) FILTER (WHERE r.id   IS NOT NULL) AS role_ids
       FROM auth.users u
       LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
       LEFT JOIN auth.roles       r  ON r.id = ur.role_id
       WHERE u.id = $1 AND u.is_deleted = FALSE
       GROUP BY u.id`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createUser(data: {
    username: string; email: string; passwordHash: string;
    fullName: string; preferredLanguage: string;
  }) {
    const { rows } = await this.db.query(
      `INSERT INTO auth.users
         (username, email, password_hash, full_name, preferred_language, must_change_password)
       VALUES ($1,$2,$3,$4,$5,TRUE)
       RETURNING id, username, email, full_name, is_active, created_at`,
      [data.username, data.email, data.passwordHash, data.fullName, data.preferredLanguage],
    );
    return rows[0];
  }

  async updateUser(id: string, data: {
    fullName?:  string; email?: string; isActive?: boolean;
    isLocked?:  boolean; preferredLanguage?: string;
  }) {
    const sets: string[]  = ['updated_at = NOW()'];
    const vals: unknown[] = [id];
    let   idx = 2;

    if (data.fullName  !== undefined) { sets.push(`full_name = $${idx++}`);           vals.push(data.fullName); }
    if (data.email     !== undefined) { sets.push(`email = $${idx++}`);               vals.push(data.email); }
    if (data.isActive  !== undefined) { sets.push(`is_active = $${idx++}`);           vals.push(data.isActive); }
    if (data.isLocked  !== undefined) {
      sets.push(`is_locked = $${idx++}`, `failed_attempts = 0`, `locked_until = NULL`);
      vals.push(data.isLocked);
    }
    if (data.preferredLanguage !== undefined) { sets.push(`preferred_language = $${idx++}`); vals.push(data.preferredLanguage); }

    const { rows } = await this.db.query(
      `UPDATE auth.users SET ${sets.join(', ')} WHERE id = $1 AND is_deleted = FALSE RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  async resetPassword(id: string, passwordHash: string) {
    await this.db.query(
      `UPDATE auth.users
       SET password_hash = $2, must_change_password = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [id, passwordHash],
    );
  }

  async deleteUser(id: string) {
    await this.db.query(
      `UPDATE auth.users
       SET is_deleted = TRUE, deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  }

  // ── Role management ───────────────────────────────────────
  async listRoles() {
    const { rows } = await this.db.query(
      `SELECT r.*,
              COUNT(ur.user_id) AS user_count
       FROM auth.roles r
       LEFT JOIN auth.user_roles ur ON ur.role_id = r.id
       GROUP BY r.id
       ORDER BY r.name`,
    );
    return rows;
  }

  async assignRole(userId: string, roleId: string, assignedBy: string) {
    await this.db.query(
      `INSERT INTO auth.user_roles (user_id, role_id, assigned_by)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [userId, roleId, assignedBy],
    );
  }

  async removeRole(userId: string, roleId: string) {
    await this.db.query(
      `DELETE FROM auth.user_roles WHERE user_id = $1 AND role_id = $2`,
      [userId, roleId],
    );
  }

  // ── Hospital settings ─────────────────────────────────────
  async getSettings() {
    const { rows } = await this.db.query(
      `SELECT * FROM settings.hospital_settings LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async updateSettings(data: Record<string, unknown>, updatedBy: string) {
    const allowed = [
      'hospital_name','hospital_name_fa','hospital_name_ps',
      'address','address_fa','phone','email','website',
      'default_language','default_currency','timezone',
      'work_start_time','work_end_time','friday_closed',
      'default_slot_minutes','max_advance_booking_days',
      'emr_lock_after_hours','tax_rate_percent',
    ];
    const sets: string[]  = ['updated_at = NOW()', 'updated_by = $1'];
    const vals: unknown[] = [updatedBy];
    let   idx = 2;

    for (const [k, v] of Object.entries(data)) {
      if (allowed.includes(k)) {
        sets.push(`${k} = $${idx++}`); vals.push(v);
      }
    }

    const { rows } = await this.db.query(
      `UPDATE settings.hospital_settings SET ${sets.join(', ')} RETURNING *`,
      vals,
    );
    return rows[0];
  }

  // ── Feature flags ─────────────────────────────────────────
  async getFeatureFlags() {
    const { rows } = await this.db.query(
      `SELECT * FROM settings.feature_flags ORDER BY flag_key`,
    );
    return rows;
  }

  async setFeatureFlag(flagKey: string, isEnabled: boolean, updatedBy: string) {
    const { rows } = await this.db.query(
      `UPDATE settings.feature_flags
       SET is_enabled = $2, updated_at = NOW(), updated_by = $3
       WHERE flag_key = $1
       RETURNING *`,
      [flagKey, isEnabled, updatedBy],
    );
    return rows[0] ?? null;
  }

  // ── Audit logs ────────────────────────────────────────────
  async getAuditLogs(filters: {
    userId?: string; tableName?: string;
    from?: string; to?: string;
    limit: number; offset: number;
  }) {
    const conds: string[] = ['1=1'];
    const vals:  unknown[] = [];
    let   i = 1;

    if (filters.userId)    { conds.push(`al.user_id = $${i++}`);           vals.push(filters.userId); }
    if (filters.tableName) { conds.push(`al.table_name = $${i++}`);        vals.push(filters.tableName); }
    if (filters.from)      { conds.push(`al.created_at >= $${i++}::DATE`); vals.push(filters.from); }
    if (filters.to)        { conds.push(`al.created_at <= $${i++}::DATE + 1`); vals.push(filters.to); }

    const where = conds.join(' AND ');

    const { rows } = await this.db.query(
      `SELECT al.*,
              u.username, u.full_name AS user_full_name
       FROM audit.audit_logs al
       LEFT JOIN auth.users u ON u.id = al.user_id
       WHERE ${where}
       ORDER BY al.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, filters.limit, filters.offset],
    );

    const { rows: cr } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM audit.audit_logs al WHERE ${where}`,
      vals,
    );

    return { rows, total: Number(cr[0].count) };
  }

  async getSecurityEvents(limit = 50) {
    const { rows } = await this.db.query(
      `SELECT se.*,
              u.username, u.full_name AS user_full_name
       FROM audit.security_events se
       LEFT JOIN auth.users u ON u.id = se.user_id
       ORDER BY se.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }
}
