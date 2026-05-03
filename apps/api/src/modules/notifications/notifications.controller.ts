import { Request, Response }     from 'express';
import { NotificationsService }  from './notifications.service';
import { asyncHandler }          from '@/shared/utils/async-handler';

const svc = new NotificationsService();

export const notificationsController = {

  getMyNotifications: asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unreadOnly === 'true';
    const data = await svc.getNotifications(req.user!.id, unreadOnly);
    res.json({ success: true, data });
  }),

  getUnreadCount: asyncHandler(async (req, res) => {
    const count = await svc.getUnreadCount(req.user!.id);
    res.json({ success: true, data: { count } });
  }),

  markRead: asyncHandler(async (req, res) => {
    await svc.markRead(req.params.id, req.user!.id);
    res.json({ success: true, data: null });
  }),

  markAllRead: asyncHandler(async (req, res) => {
    await svc.markAllRead(req.user!.id);
    res.json({ success: true, data: { message: 'All notifications marked as read.' } });
  }),

  getPreferences: asyncHandler(async (req, res) => {
    const data = await svc.getPreferences(req.user!.id);
    res.json({ success: true, data });
  }),

  updatePreference: asyncHandler(async (req, res) => {
    const { eventCategory, channelCode, isEnabled } = req.body;
    await svc.updatePreference(req.user!.id, eventCategory, channelCode, isEnabled);
    res.json({ success: true, data: { message: 'Preference updated.' } });
  }),

  // Admin: send manual notification
  sendManual: asyncHandler(async (req, res) => {
    const { userId, eventType, variables, channels, priority } = req.body;
    await svc.sendToUser(userId, eventType, variables, { channels, priority });
    res.json({ success: true, data: { message: 'Notification queued.' } });
  }),
};
