import bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { LoginInput, AuthTokens } from './auth.types';
import {
  signAccessToken, generateRefreshToken,
  hashRefreshToken, refreshTokenExpiry,
} from '@/shared/utils/jwt.util';
import { UnauthorizedError } from '@/shared/errors/app-error';
import { logger } from '@/infrastructure/logger/logger';

const MAX_ATTEMPTS  = 5;
const LOCK_MINUTES  = 30;

export class AuthService {
  private repo = new AuthRepository();

  async login(
    input: LoginInput,
    ip:    string,
    ua:    string,
  ): Promise<AuthTokens & {
    user: { id: string; username: string; mustChangePassword: boolean }
  }> {
    const user = await this.repo.findUserByUsername(input.username);

    if (!user) {
      logger.warn('Login failed — user not found', { username: input.username, ip });
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.is_active || (user as any).is_deleted) {
      throw new UnauthorizedError('Account is inactive');
    }

    if (user.is_locked && user.locked_until && user.locked_until > new Date()) {
      const mins = Math.ceil((user.locked_until.getTime() - Date.now()) / 60000);
      throw new UnauthorizedError(`Account locked. Try again in ${mins} minute(s).`);
    }

    const valid = await bcrypt.compare(input.password, user.password_hash);

    if (!valid) {
      const attempts = await this.repo.incrementFailedAttempts(user.id);
      logger.warn('Login failed — wrong password', { userId: user.id, attempts, ip });

      if (attempts >= MAX_ATTEMPTS) {
        const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        await this.repo.lockUser(user.id, until);
        throw new UnauthorizedError(
          `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`,
        );
      }

      throw new UnauthorizedError('Invalid credentials');
    }

    const [roles, permissions] = await Promise.all([
      this.repo.getUserRoles(user.id),
      this.repo.getUserPermissions(user.id),
    ]);

    const accessToken        = signAccessToken({
      sub:         user.id,
      username:    user.username,
      roles:       roles.map(r => r.name),
      permissions: permissions.map(p => p.code),
    });

    const { raw, hash } = generateRefreshToken();
    const expiresAt     = refreshTokenExpiry();

    await this.repo.saveRefreshToken(user.id, hash, expiresAt, { ip, userAgent: ua });
    await this.repo.resetLoginState(user.id, ip);

    logger.info('Login successful', { userId: user.id, ip });

    return {
      accessToken,
      refreshToken: raw,
      expiresIn:    15 * 60,
      user: {
        id:                 user.id,
        username:           user.username,
        mustChangePassword: user.must_change_password,
      },
    };
  }

  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(rawToken);
    const stored    = await this.repo.findRefreshToken(tokenHash);

    if (!stored) throw new UnauthorizedError('Invalid refresh token');

    if (stored.revoked_at) {
      await this.repo.revokeAllUserTokens(stored.user_id);
      logger.warn('Refresh token reuse — all tokens revoked', { userId: stored.user_id });
      throw new UnauthorizedError('Session expired. Please log in again.');
    }

    if (stored.expires_at < new Date()) {
      throw new UnauthorizedError('Refresh token expired. Please log in again.');
    }

    await this.repo.revokeRefreshToken(tokenHash);

    const user = await this.repo.findUserById(stored.user_id);
    if (!user || !user.is_active) throw new UnauthorizedError('Account inactive');

    const [roles, permissions] = await Promise.all([
      this.repo.getUserRoles(user.id),
      this.repo.getUserPermissions(user.id),
    ]);

    const accessToken   = signAccessToken({
      sub:         user.id,
      username:    user.username,
      roles:       roles.map(r => r.name),
      permissions: permissions.map(p => p.code),
    });

    const { raw, hash } = generateRefreshToken();
    await this.repo.saveRefreshToken(user.id, hash, refreshTokenExpiry(), {});

    return { accessToken, refreshToken: raw, expiresIn: 15 * 60 };
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(rawToken);
    await this.repo.revokeRefreshToken(tokenHash);
  }

  async getMe(userId: string): Promise<object> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new UnauthorizedError();

    const [roles, permissions] = await Promise.all([
      this.repo.getUserRoles(userId),
      this.repo.getUserPermissions(userId),
    ]);

    return {
      id:                 user.id,
      username:           user.username,
      email:              user.email,
      fullName:           user.full_name,
      preferredLanguage:  user.preferred_language,
      mustChangePassword: user.must_change_password,
      roles:              roles.map(r => r.name),
      permissions:        permissions.map(p => p.code),
    };
  }

  async changePassword(
    userId:          string,
    currentPassword: string,
    newPassword:     string,
  ): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new UnauthorizedError();

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.repo.updatePassword(userId, newHash);
    await this.repo.revokeAllUserTokens(userId);

    logger.info('Password changed — all sessions revoked', { userId });
  }
}
