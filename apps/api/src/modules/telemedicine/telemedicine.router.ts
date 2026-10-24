import { Router }                  from 'express';
import { telemedicineController }  from './telemedicine.controller';
import { authenticate }            from '@/shared/middleware/authenticate';
import { validate, validateQuery } from '@/shared/middleware/validate';
import { authorize } from '@/shared/middleware/authorize';
import { createSessionSchema, sendMessageSchema, joinQuerySchema } from './telemedicine.validation';

export const telemedicineRouter = Router();

// Public — join via token (patient link has no JWT)
telemedicineRouter.get('/join', validateQuery(joinQuerySchema), telemedicineController.joinSession);

// Protected — requires auth
telemedicineRouter.use(authenticate);

telemedicineRouter.post('/',
  authorize('emr:write'),
  validate(createSessionSchema),
  telemedicineController.createSession,
);

telemedicineRouter.get('/doctor/:doctorId',
  telemedicineController.getDoctorSessions,
);

telemedicineRouter.get('/:id',
  telemedicineController.getSession,
);

telemedicineRouter.get('/:id/chat',
  telemedicineController.getChatHistory,
);

telemedicineRouter.post('/:id/chat',
  validate(sendMessageSchema),
  telemedicineController.sendChatMessage,
);

telemedicineRouter.post('/:id/end',
  telemedicineController.endSession,
);
