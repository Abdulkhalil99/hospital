import bcrypt from 'bcrypt';
import { AdminRepository }  from './admin.repository';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/errors/app-error';
import { logger } from '@/infrastructure/logger/logger';

export class AdminService {
  private repo = new AdminRepository();

  // ── Users ─────────────────────────────────────────────────
  async listUsers(q = '', page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.repo.listUsers(q, limit, offset),
      this.repo.countUsers(q),
    ]);
    return { data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getUserById(id: string) {
    const user = await this.repo.getUserById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  async createUser(data: {
    username: string; email: string; password: string;
    fullName: string; preferredLanguage?: string;
    roleIds?: string[];
  }, createdBy: string) {
    if (data.password.length < 8) {
      throw new ValidationError([{ message: 'Password must be at least 8 characters.' }]);
    }
    const hash = await bcrypt.hash(data.password, 12);
    const user = await this.repo.createUser({
      username:          data.username,
      email:             data.email,
      passwordHash:      hash,
      fullName:          data.fullName,
      preferredLanguage: data.preferredLanguage ?? 'en',
    });

    // Assign roles
    for (const roleId of data.roleIds ?? []) {
      await this.repo.assignRole(user.id, roleId, createdBy);
    }

    logger.info('User created by admin', { userId: user.id, createdBy });
    return user;
  }

  async updateUser(id: string, data: {
    fullName?: string; email?: string; isActive?: boolean;
    isLocked?: boolean; preferredLanguage?: string;
  }, updatedBy: string) {
    await this.getUserById(id);
    const updated = await this.repo.updateUser(id, data);
    logger.info('User updated by admin', { userId: id, updatedBy });
    return updated;
  }

  async resetPassword(id: string, newPassword: string, resetBy: string) {
    if (newPassword.length < 8) {
      throw new ValidationError([{ message: 'Password must be at least 8 characters.' }]);
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await this.repo.resetPassword(id, hash);
    logger.info('Password reset by admin', { userId: id, resetBy });
  }

  async deleteUser(id: string, deletedBy: string) {
    await this.getUserById(id);
    await this.repo.deleteUser(id);
    logger.info('User deleted by admin', { userId: id, deletedBy });
  }

  // ── Roles ─────────────────────────────────────────────────
  async listRoles() { return this.repo.listRoles(); }

  async assignRole(userId: string, roleId: string, assignedBy: string) {
    await this.getUserById(userId);
    await this.repo.assignRole(userId, roleId, assignedBy);
    logger.info('Role assigned', { userId, roleId, assignedBy });
  }

  async removeRole(userId: string, roleId: string) {
    await this.repo.removeRole(userId, roleId);
  }

  // ── Settings ──────────────────────────────────────────────
  async getSettings()                               { return this.repo.getSettings(); }
  async updateSettings(data: Record<string, unknown>, by: string) { return this.repo.updateSettings(data, by); }

  // ── Feature flags ─────────────────────────────────────────
  async getFeatureFlags()                                  { return this.repo.getFeatureFlags(); }
  async setFeatureFlag(key: string, val: boolean, by: string) { return this.repo.setFeatureFlag(key, val, by); }

  // ── Audit ──────────────────────────────────────────────────
  async getAuditLogs(filters: {
    userId?: string; tableName?: string;
    from?: string;   to?: string;
    page?: number;   limit?: number;
  }) {
    const limit  = Math.min(200, filters.limit  ?? 50);
    const offset = ((filters.page ?? 1) - 1) * limit;
    return this.repo.getAuditLogs({ ...filters, limit, offset });
  }

  async getSecurityEvents(limit = 50) { return this.repo.getSecurityEvents(limit); }
}
