import { Router }          from 'express';
import { portalController} from './portal.controller';
import { authenticate }    from '@/shared/middleware/authenticate';
import { validate }        from '@/shared/middleware/validate';
import { engagementRouter } from './engagement.router';
import { asyncHandler } from '@/shared/utils/async-handler';
import { exportMyFhirSummary } from './fhir-export.service';
import {
  verifiedLinkPatientSchema,
  cancelPortalAppointmentSchema,
} from './portal.validation';

export const portalRouter = Router();
portalRouter.use(authenticate);
portalRouter.use(engagementRouter);

portalRouter.get('/profile',          portalController.getProfile);
portalRouter.get('/summary',          portalController.getMedicalSummary);
portalRouter.get('/appointments',     portalController.getAppointments);
portalRouter.post('/appointments/:appointmentId/cancel',
  validate(cancelPortalAppointmentSchema),
  portalController.cancelAppointment,
);
portalRouter.get('/lab-results',      portalController.getLabResults);
portalRouter.get('/prescriptions',    portalController.getPrescriptions);
portalRouter.get('/invoices',         portalController.getInvoices);
portalRouter.get('/invoices/:invoiceId', portalController.getInvoiceDetail);
portalRouter.get('/allergies',        portalController.getAllergies);
portalRouter.get('/export/fhir', asyncHandler(async (req, res) => {
  const { bundle, mrn } = await exportMyFhirSummary(req.user!.id);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="medicore-${mrn.replace(/[^A-Za-z0-9_-]/g, '_')}-fhir-summary.json"`);
  res.type('application/fhir+json').send(JSON.stringify(bundle));
}));
portalRouter.post('/link-patient',
  validate(verifiedLinkPatientSchema),
  portalController.linkPatient,
);
