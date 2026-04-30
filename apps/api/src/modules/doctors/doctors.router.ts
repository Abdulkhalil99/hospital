import { Router }           from 'express';
import { doctorsController } from './doctors.controller';
import { authenticate }     from '@/shared/middleware/authenticate';
import { authorize }        from '@/shared/middleware/authorize';
import { validate }         from '@/shared/middleware/validate';
import {
  createDoctorSchema, updateDoctorSchema,
  scheduleSchema, leaveSchema,
} from './doctors.validation';

export const doctorsRouter = Router();

doctorsRouter.use(authenticate);

// ── Reference data (public-ish, any authenticated user) ─────
doctorsRouter.get('/specialties',  doctorsController.getSpecialties);
doctorsRouter.get('/departments',  doctorsController.getDepartments);

// ── My profile (doctor reads their own) ──────────────────────
doctorsRouter.get('/me', doctorsController.getMyProfile);

// ── List + CRUD ───────────────────────────────────────────────
doctorsRouter.get('/',
  authorize('patient:read'),
  doctorsController.list,
);

doctorsRouter.get('/:id',
  authorize('patient:read'),
  doctorsController.getById,
);

doctorsRouter.post('/',
  authorize('user:manage'),
  validate(createDoctorSchema),
  doctorsController.create,
);

doctorsRouter.patch('/:id',
  authorize('user:manage'),
  validate(updateDoctorSchema),
  doctorsController.update,
);

doctorsRouter.delete('/:id',
  authorize('user:manage'),
  doctorsController.delete,
);

// ── Schedule management ────────────────────────────────────────
doctorsRouter.get('/:id/schedules',
  authorize('patient:read'),
  doctorsController.getSchedules,
);

doctorsRouter.put('/:id/schedules',
  authorize('settings:manage'),
  validate(scheduleSchema),
  doctorsController.setSchedule,
);

doctorsRouter.delete('/:id/schedules/:scheduleId',
  authorize('settings:manage'),
  doctorsController.deleteSchedule,
);

// ── Leave management ───────────────────────────────────────────
doctorsRouter.get('/:id/leaves',
  authorize('patient:read'),
  doctorsController.getLeaves,
);

doctorsRouter.post('/:id/leaves',
  authorize('settings:manage'),
  validate(leaveSchema),
  doctorsController.addLeave,
);

doctorsRouter.delete('/:id/leaves/:leaveId',
  authorize('settings:manage'),
  doctorsController.removeLeave,
);

// ── Availability ───────────────────────────────────────────────
doctorsRouter.get('/:id/availability',
  authorize('appointment:read'),
  doctorsController.getAvailability,
);
