import { Request, Response } from 'express';
import { AuthService }       from './auth.service';
import { asyncHandler }      from '@/shared/utils/async-handler';

const service = new AuthService();

function meta(req: Request) {
  return { requestId: req.headers['x-request-id'], timestamp: new Date().toISOString() };
}

export const authController = {
  login: asyncHandler(async (req, res) => {
    const ip     = (req.ip ?? 'unknown').replace('::ffff:', '');
    const ua     = req.headers['user-agent'] ?? 'unknown';
    const result = await service.login(req.body, ip, ua);
    res.json({ success: true, data: result, meta: meta(req) });
  }),

  refresh: asyncHandler(async (req, res) => {
    const tokens = await service.refresh(req.body.refreshToken);
    res.json({ success: true, data: tokens });
  }),

  logout: asyncHandler(async (req, res) => {
    if (req.body?.refreshToken) await service.logout(req.body.refreshToken);
    res.json({ success: true, data: { message: 'Logged out' } });
  }),

  me: asyncHandler(async (req, res) => {
    const user = await service.getMe(req.user!.id);
    res.json({ success: true, data: user });
  }),

  changePassword: asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await service.changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ success: true, data: { message: 'Password changed. Please log in again.' } });
  }),
};
