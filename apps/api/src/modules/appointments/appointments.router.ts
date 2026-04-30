import { Router }                  from 'express';
import { appointmentsController }  from './appointments.controller';
import { authenticate }            from '@/shared/middleware/authenticate';
import { authorize }               from '@/shared/middleware/authorize';
import { validate }                from '@/shared/middleware/validate';
import {
  createAppointmentSchema,
  cancelSchema,
} from './appointments.validation';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

// Reference data
appointmentsRouter.get('/types',
  appointmentsController.getTypes,
);

// Appointments CRUD
appointmentsRouter.get('/',
  authorize('appointment:read'),
  appointmentsController.list,
);

appointmentsRouter.get('/:id',
  authorize('appointment:read'),
  appointmentsController.getById,
);

appointmentsRouter.post('/',
  authorize('appointment:create'),
  validate(createAppointmentSchema),
  appointmentsController.book,
);

appointmentsRouter.post('/:id/cancel',
  authorize('appointment:cancel'),
  validate(cancelSchema),
  appointmentsController.cancel,
);

appointmentsRouter.post('/:id/checkin',
  authorize('appointment:checkin'),
  appointmentsController.checkin,
);

// Queue
appointmentsRouter.get('/queue/:doctorId',
  authorize('queue:read'),
  appointmentsController.getLiveQueue,
);

appointmentsRouter.post('/queue/:doctorId/call-next',
  authorize('queue:call_next'),
  appointmentsController.callNext,
);

appointmentsRouter.post('/queue/tokens/:tokenId/complete',
  authorize('queue:call_next'),
  appointmentsController.completeToken,
);

appointmentsRouter.post('/queue/tokens/:tokenId/skip',
  authorize('queue:manage'),
  appointmentsController.skipToken,
);
