const mockRepo = {
  rotateRefreshToken: jest.fn(),
  findRefreshToken: jest.fn(),
  findUserById: jest.fn(),
  getUserRoles: jest.fn(),
  getUserPermissions: jest.fn(),
  revokeAllUserTokens: jest.fn(),
  saveRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
};
jest.mock('@/modules/auth/auth.repository', () => ({
  AuthRepository: jest.fn().mockImplementation(() => mockRepo),
}));
jest.mock('@/infrastructure/logger/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('@/shared/utils/jwt.util', () => ({
  hashRefreshToken: jest.fn(() => 'old-hash'),
  signRefreshToken: jest.fn(() => ({ raw: 'new-token', hash: 'new-hash' })),
  refreshTokenExpiry: jest.fn(() => new Date('2099-01-01T00:00:00Z')),
  signAccessToken: jest.fn(() => 'access-token'),
}));

import { AuthService } from '@/modules/auth/auth.service';

describe('Atomic refresh token rotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.rotateRefreshToken.mockResolvedValue({ user_id: 'user-1' });
    mockRepo.findUserById.mockResolvedValue({ id: 'user-1', username: 'doctor', is_active: true });
    mockRepo.getUserRoles.mockResolvedValue([{ name: 'doctor' }]);
    mockRepo.getUserPermissions.mockResolvedValue([{ code: 'emr:read' }]);
  });

  it('returns the replacement persisted by the atomic rotation', async () => {
    await expect(new AuthService().refresh('old-token')).resolves.toEqual({
      accessToken: 'access-token', refreshToken: 'new-token', expiresIn: 900,
    });
    expect(mockRepo.rotateRefreshToken).toHaveBeenCalledWith(
      'old-hash', 'new-hash', new Date('2099-01-01T00:00:00Z'),
    );
    expect(mockRepo.findRefreshToken).not.toHaveBeenCalled();
    expect(mockRepo.saveRefreshToken).not.toHaveBeenCalled();
    expect(mockRepo.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it('allows one concurrent refresh and rejects reuse of the consumed token', async () => {
    mockRepo.rotateRefreshToken.mockResolvedValueOnce({ user_id: 'user-1' }).mockResolvedValueOnce(null);
    mockRepo.findRefreshToken.mockResolvedValue({ user_id: 'user-1', revoked_at: new Date() });
    const outcomes = await Promise.allSettled([
      new AuthService().refresh('old-token'),
      new AuthService().refresh('old-token'),
    ]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find(outcome => outcome.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ statusCode: 401 });
    expect(mockRepo.revokeAllUserTokens).toHaveBeenCalledWith('user-1');
  });

  it('rejects expired tokens without issuing an access token', async () => {
    mockRepo.rotateRefreshToken.mockResolvedValue(null);
    mockRepo.findRefreshToken.mockResolvedValue({ expires_at: new Date('2000-01-01'), revoked_at: null });
    await expect(new AuthService().refresh('expired')).rejects.toMatchObject({
      statusCode: 401, message: 'Refresh token expired. Please log in again.',
    });
    expect(mockRepo.findUserById).not.toHaveBeenCalled();
  });

  it('rejects unknown tokens', async () => {
    mockRepo.rotateRefreshToken.mockResolvedValue(null);
    mockRepo.findRefreshToken.mockResolvedValue(null);
    await expect(new AuthService().refresh('unknown')).rejects.toMatchObject({
      statusCode: 401, message: 'Invalid refresh token',
    });
  });

  it('revokes the persisted replacement when the account has become inactive', async () => {
    mockRepo.findUserById.mockResolvedValue({ id: 'user-1', is_active: false });
    await expect(new AuthService().refresh('old-token')).rejects.toMatchObject({ statusCode: 401 });
    expect(mockRepo.revokeAllUserTokens).toHaveBeenCalledWith('user-1');
    expect(mockRepo.getUserRoles).not.toHaveBeenCalled();
  });
});
