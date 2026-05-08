import { Request, Response } from 'express';
import { AdminService }      from './admin.service';
import { asyncHandler }      from '@/shared/utils/async-handler';

const svc = new AdminService();

export const adminController = {
  // Users
  listUsers:     asyncHandler(async (req, res) => {
    const { q, page, limit } = req.query as Record<string,string>;
    res.json({ success: true, ...(await svc.listUsers(q, Number(page??1), Number(limit??50))) });
  }),
  getUserById:   asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getUserById(req.params.id) });
  }),
  createUser:    asyncHandler(async (req, res) => {
    const user = await svc.createUser(req.body, req.user!.id);
    res.status(201).json({ success: true, data: user });
  }),
  updateUser:    asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.updateUser(req.params.id, req.body, req.user!.id) });
  }),
  resetPassword: asyncHandler(async (req, res) => {
    await svc.resetPassword(req.params.id, req.body.newPassword, req.user!.id);
    res.json({ success: true, data: { message: 'Password reset successfully.' } });
  }),
  deleteUser:    asyncHandler(async (req, res) => {
    await svc.deleteUser(req.params.id, req.user!.id);
    res.json({ success: true, data: null });
  }),

  // Roles
  listRoles:     asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.listRoles() });
  }),
  assignRole:    asyncHandler(async (req, res) => {
    await svc.assignRole(req.params.userId, req.body.roleId, req.user!.id);
    res.json({ success: true, data: { message: 'Role assigned.' } });
  }),
  removeRole:    asyncHandler(async (req, res) => {
    await svc.removeRole(req.params.userId, req.params.roleId);
    res.json({ success: true, data: null });
  }),

  // Settings
  getSettings:   asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.getSettings() });
  }),
  updateSettings:asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.updateSettings(req.body, req.user!.id) });
  }),

  // Feature flags
  getFlags:      asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.getFeatureFlags() });
  }),
  setFlag:       asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.setFeatureFlag(req.params.key, req.body.isEnabled, req.user!.id) });
  }),

  // Audit
  getAuditLogs:  asyncHandler(async (req, res) => {
    const { userId, tableName, from, to, page, limit } = req.query as Record<string,string>;
    res.json({ success: true, ...(await svc.getAuditLogs({ userId, tableName, from, to, page: Number(page??1), limit: Number(limit??50) })) });
  }),
  getSecurityEvents: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getSecurityEvents(Number(req.query.limit??50)) });
  }),
};
