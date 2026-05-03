import { Router }                    from 'express';
import { notificationsController }   from './notifications.controller';
import { authenticate }              from '@/shared/middleware/authenticate';
import { authorize }                 from '@/shared/middleware/authorize';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// User's own notification inbox
notificationsRouter.get('/',             notificationsController.getMyNotifications);
notificationsRouter.get('/unread-count', notificationsController.getUnreadCount);
notificationsRouter.post('/:id/read',    notificationsController.markRead);
notificationsRouter.post('/read-all',    notificationsController.markAllRead);

// User preferences
notificationsRouter.get('/preferences',   notificationsController.getPreferences);
notificationsRouter.put('/preferences',   notificationsController.updatePreference);

// Admin: manual notification
notificationsRouter.post('/send',
  authorize('settings:manage'),
  notificationsController.sendManual,
);
