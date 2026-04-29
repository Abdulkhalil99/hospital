import { Router }    from 'express';
import { patientsController }  from './patients.controller';
import { authenticate }        from '@/shared/middleware/authenticate';
import { authorize }           from '@/shared/middleware/authorize';
import { validate }            from '@/shared/middleware/validate';
import { createPatientSchema, updatePatientSchema } from './patients.validation';
import { PERMISSIONS }         from '@medicore/shared-constants';

export const patientsRouter = Router();

// Every route in this module requires a valid JWT
patientsRouter.use(authenticate);

patientsRouter.get(
  '/search',
  authorize(PERMISSIONS.PATIENT_SEARCH),
  patientsController.search,
);

patientsRouter.get(
  '/mrn/:mrn',
  authorize(PERMISSIONS.PATIENT_READ),
  patientsController.getByMrn,
);

patientsRouter.get(
  '/:id',
  authorize(PERMISSIONS.PATIENT_READ),
  patientsController.getById,
);

patientsRouter.post(
  '/',
  authorize(PERMISSIONS.PATIENT_CREATE),
  validate(createPatientSchema),
  patientsController.create,
);

patientsRouter.patch(
  '/:id',
  authorize(PERMISSIONS.PATIENT_UPDATE),
  validate(updatePatientSchema),
  patientsController.update,
);

patientsRouter.delete(
  '/:id',
  authorize(PERMISSIONS.PATIENT_DELETE),
  patientsController.delete,
);