import { Router }               from 'express';
import { laboratoryController } from './laboratory.controller';
import { authenticate }         from '@/shared/middleware/authenticate';
import { authorize }            from '@/shared/middleware/authorize';
import { validate }             from '@/shared/middleware/validate';
import {
  collectSampleSchema, receiveSampleSchema,
  rejectSampleSchema, enterResultSchema,
  validateResultSchema, releaseResultSchema,
} from './laboratory.validation';

export const laboratoryRouter = Router();
laboratoryRouter.use(authenticate);

// ── Test catalog ───────────────────────────────────────────────
laboratoryRouter.get('/tests',
  authorize('lab:order_read'),
  laboratoryController.getTestCatalog,
);
laboratoryRouter.get('/tests/:id',
  authorize('lab:order_read'),
  laboratoryController.getTestWithRanges,
);

// ── Worklist ───────────────────────────────────────────────────
laboratoryRouter.get('/worklist',
  authorize('lab:order_read'),
  laboratoryController.getWorklist,
);
laboratoryRouter.get('/orders/:id',
  authorize('lab:order_read'),
  laboratoryController.getOrderById,
);

// ── Sample management ──────────────────────────────────────────
laboratoryRouter.post('/samples/collect',
  authorize('lab:result_enter'),
  validate(collectSampleSchema),
  laboratoryController.collectSample,
);
laboratoryRouter.post('/samples/receive',
  authorize('lab:result_enter'),
  validate(receiveSampleSchema),
  laboratoryController.receiveSample,
);
laboratoryRouter.post('/samples/reject',
  authorize('lab:result_enter'),
  validate(rejectSampleSchema),
  laboratoryController.rejectSample,
);

// ── Results ────────────────────────────────────────────────────
laboratoryRouter.post('/results',
  authorize('lab:result_enter'),
  validate(enterResultSchema),
  laboratoryController.enterResults,
);
laboratoryRouter.post('/results/validate',
  authorize('lab:result_validate'),
  validate(validateResultSchema),
  laboratoryController.validateResults,
);
laboratoryRouter.post('/results/release',
  authorize('lab:result_validate'),
  validate(releaseResultSchema),
  laboratoryController.releaseResults,
);
laboratoryRouter.get('/results/sample/:sampleId',
  authorize('lab:order_read'),
  laboratoryController.getResultsBySample,
);
laboratoryRouter.get('/results/order/:orderId',
  authorize('lab:order_read'),
  laboratoryController.getResultsByOrder,
);
laboratoryRouter.get('/results/patient/:patientId',
  authorize('emr:read'),
  laboratoryController.getResultsByPatient,
);

// ── Critical alerts ────────────────────────────────────────────
laboratoryRouter.get('/critical-alerts',
  authorize('lab:order_read'),
  laboratoryController.getPendingCriticalAlerts,
);
laboratoryRouter.post('/critical-alerts/:alertId/acknowledge',
  authorize('emr:read'),
  laboratoryController.acknowledgeCriticalAlert,
);
