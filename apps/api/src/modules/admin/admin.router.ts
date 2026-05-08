import { Router }          from 'express';
import { adminController } from './admin.controller';
import { authenticate }    from '@/shared/middleware/authenticate';
import { authorize }       from '@/shared/middleware/authorize';

export const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('user:manage'));

// Users
adminRouter.get('/users',                     adminController.listUsers);
adminRouter.get('/users/:id',                 adminController.getUserById);
adminRouter.post('/users',                    adminController.createUser);
adminRouter.patch('/users/:id',               adminController.updateUser);
adminRouter.post('/users/:id/reset-password', adminController.resetPassword);
adminRouter.delete('/users/:id',              adminController.deleteUser);

// Roles
adminRouter.get('/roles',                     adminController.listRoles);
adminRouter.post('/users/:userId/roles',      adminController.assignRole);
adminRouter.delete('/users/:userId/roles/:roleId', adminController.removeRole);

// Settings
adminRouter.get('/settings',                  adminController.getSettings);
adminRouter.patch('/settings',                adminController.updateSettings);

// Feature flags
adminRouter.get('/flags',                     adminController.getFlags);
adminRouter.patch('/flags/:key',              adminController.setFlag);

// Audit
adminRouter.get('/audit',                     adminController.getAuditLogs);
adminRouter.get('/security-events',           adminController.getSecurityEvents);
