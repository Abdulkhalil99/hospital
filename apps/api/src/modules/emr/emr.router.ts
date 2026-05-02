import { Router }         from 'express';
import { emrController }  from './emr.controller';
import { authenticate }   from '@/shared/middleware/authenticate';
import { authorize }      from '@/shared/middleware/authorize';
import { validate }       from '@/shared/middleware/validate';
import {
  createEncounterSchema, vitalSignsSchema,
  clinicalNoteSchema, diagnosisSchema,
  prescriptionSchema, labOrderSchema, imagingOrderSchema,
} from './emr.validation';

export const emrRouter = Router();
emrRouter.use(authenticate);

// ── Encounters ────────────────────────────────────────────────
emrRouter.post('/',
  authorize('emr:write'),
  validate(createEncounterSchema),
  emrController.createEncounter,
);

emrRouter.get('/patient/:patientId',
  authorize('emr:read'),
  emrController.getEncountersByPatient,
);

emrRouter.get('/doctor/:doctorId',
  authorize('emr:read'),
  emrController.getEncountersByDoctor,
);

emrRouter.get('/patient/:patientId/history',
  authorize('emr:read'),
  emrController.getMedicalHistory,
);

emrRouter.get('/:id',
  authorize('emr:read'),
  emrController.getEncounterById,
);

emrRouter.get('/:id/full',
  authorize('emr:read'),
  emrController.getFullEncounter,
);

emrRouter.post('/:id/complete',
  authorize('emr:write'),
  emrController.completeEncounter,
);

// ── Vital signs ────────────────────────────────────────────────
emrRouter.get('/:id/vitals',
  authorize('emr:read'),
  emrController.getVitalSigns,
);
emrRouter.post('/:id/vitals',
  authorize('emr:write'),
  validate(vitalSignsSchema),
  emrController.addVitalSigns,
);

// ── Clinical notes ─────────────────────────────────────────────
emrRouter.get('/:id/notes',
  authorize('emr:read'),
  emrController.getClinicalNotes,
);
emrRouter.post('/:id/notes',
  authorize('emr:write'),
  validate(clinicalNoteSchema),
  emrController.addClinicalNote,
);

// ── Diagnoses ──────────────────────────────────────────────────
emrRouter.get('/:id/diagnoses',
  authorize('emr:read'),
  emrController.getDiagnoses,
);
emrRouter.post('/:id/diagnoses',
  authorize('emr:write'),
  validate(diagnosisSchema),
  emrController.addDiagnosis,
);
emrRouter.delete('/:id/diagnoses/:diagnosisId',
  authorize('emr:write'),
  emrController.removeDiagnosis,
);

// ── Prescriptions ──────────────────────────────────────────────
emrRouter.get('/:id/prescriptions',
  authorize('emr:read'),
  emrController.getPrescriptions,
);
emrRouter.post('/:id/prescriptions',
  authorize('emr:write'),
  validate(prescriptionSchema),
  emrController.addPrescription,
);
emrRouter.post('/:id/prescriptions/:prescriptionId/cancel',
  authorize('emr:write'),
  emrController.cancelPrescription,
);

// ── Lab orders ─────────────────────────────────────────────────
emrRouter.get('/:id/lab-orders',
  authorize('emr:read'),
  emrController.getLabOrders,
);
emrRouter.post('/:id/lab-orders',
  authorize('emr:write'),
  validate(labOrderSchema),
  emrController.addLabOrder,
);

// ── Imaging orders ─────────────────────────────────────────────
emrRouter.get('/:id/imaging-orders',
  authorize('emr:read'),
  emrController.getImagingOrders,
);
emrRouter.post('/:id/imaging-orders',
  authorize('emr:write'),
  validate(imagingOrderSchema),
  emrController.addImagingOrder,
);
