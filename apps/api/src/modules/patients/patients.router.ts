import { Router }              from 'express';
import { patientsController }  from './patients.controller';
import { authenticate }        from '@/shared/middleware/authenticate';
import { authorize }           from '@/shared/middleware/authorize';
import { validate }            from '@/shared/middleware/validate';
import {
  createPatientSchema, updatePatientSchema,
  allergySchema, familyMemberSchema,
  searchSchema, verifyOtpSchema,
} from './patients.validation';

export const patientsRouter = Router();

patientsRouter.use(authenticate);

// ── Search & lookup ──────────────────────────────────────────
patientsRouter.get('/',              authorize('patient:search'), patientsController.search);
patientsRouter.get('/mrn/:mrn',      authorize('patient:read'),   patientsController.getByMrn);
patientsRouter.get('/:id',           authorize('patient:read'),   patientsController.getById);

// ── Registration ─────────────────────────────────────────────
patientsRouter.post('/',
  authorize('patient:create'),
  validate(createPatientSchema),
  patientsController.register,
);

// ── OTP verification ──────────────────────────────────────────
patientsRouter.post('/:id/verify-otp',
  authorize('patient:create'),
  validate(verifyOtpSchema),
  patientsController.verifyOtp,
);

patientsRouter.post('/:id/resend-otp',
  authorize('patient:create'),
  patientsController.resendOtp,
);

// ── Profile update ────────────────────────────────────────────
patientsRouter.patch('/:id',
  authorize('patient:update'),
  validate(updatePatientSchema),
  patientsController.update,
);

patientsRouter.delete('/:id',
  authorize('patient:delete'),
  patientsController.delete,
);

// ── Allergies ─────────────────────────────────────────────────
patientsRouter.get('/:id/allergies',
  authorize('patient:read'),
  patientsController.getAllergies,
);
patientsRouter.post('/:id/allergies',
  authorize('emr:write'),
  validate(allergySchema),
  patientsController.addAllergy,
);
patientsRouter.delete('/:id/allergies/:allergyId',
  authorize('emr:write'),
  patientsController.removeAllergy,
);

// ── Family accounts ───────────────────────────────────────────
patientsRouter.get('/:id/family',
  authorize('patient:read'),
  patientsController.getFamilyMembers,
);
patientsRouter.post('/:id/family',
  authorize('patient:update'),
  validate(familyMemberSchema),
  patientsController.addFamilyMember,
);
patientsRouter.delete('/:id/family/:memberId',
  authorize('patient:update'),
  patientsController.removeFamilyMember,
);

// ── Medical history ───────────────────────────────────────────
patientsRouter.get('/:id/medical-history',
  authorize('emr:read'),
  patientsController.getMedicalHistory,
);
