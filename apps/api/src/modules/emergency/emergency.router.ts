import { Router }               from 'express';
import { emergencyController }  from './emergency.controller';
import { authenticate }         from '@/shared/middleware/authenticate';
import { authorize }            from '@/shared/middleware/authorize';
import { validate }             from '@/shared/middleware/validate';
import {
  registerVisitSchema, triageSchema,
  assignBedSchema, updateStatusSchema, traumaSchema,
} from './emergency.validation';

export const emergencyRouter = Router();
emergencyRouter.use(authenticate);

// ── Dashboard ──────────────────────────────────────────────────
emergencyRouter.get('/dashboard',
  authorize('emergency:read'),
  emergencyController.getDashboard,
);

emergencyRouter.get('/stats/today',
  authorize('emergency:read'),
  emergencyController.getTodayStats,
);

// ── Visits ─────────────────────────────────────────────────────
emergencyRouter.post('/visits',
  authorize('emergency:triage'),
  validate(registerVisitSchema),
  emergencyController.registerVisit,
);

emergencyRouter.get('/visits/:id',
  authorize('emergency:read'),
  emergencyController.getVisitById,
);

emergencyRouter.post('/visits/status',
  authorize('emergency:triage'),
  validate(updateStatusSchema),
  emergencyController.updateVisitStatus,
);

// ── Triage ─────────────────────────────────────────────────────
emergencyRouter.post('/triage',
  authorize('emergency:triage'),
  validate(triageSchema),
  emergencyController.performTriage,
);

emergencyRouter.get('/triage/:visitId',
  authorize('emergency:read'),
  emergencyController.getTriageByVisit,
);

// ── Beds ───────────────────────────────────────────────────────
emergencyRouter.get('/beds',
  authorize('emergency:read'),
  emergencyController.getAvailableBeds,
);

emergencyRouter.get('/beds/board',
  authorize('emergency:read'),
  emergencyController.getBedBoard,
);

emergencyRouter.post('/beds/assign',
  authorize('emergency:bed_manage'),
  validate(assignBedSchema),
  emergencyController.assignBed,
);

// ── Trauma ─────────────────────────────────────────────────────
emergencyRouter.post('/trauma',
  authorize('emergency:triage'),
  validate(traumaSchema),
  emergencyController.activateTrauma,
);

emergencyRouter.get('/trauma',
  authorize('emergency:read'),
  emergencyController.getTraumaActivations,
);
