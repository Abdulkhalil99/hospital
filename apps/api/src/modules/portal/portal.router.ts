import { Router }          from 'express';
import { portalController} from './portal.controller';
import { authenticate }    from '@/shared/middleware/authenticate';
import { validate }        from '@/shared/middleware/validate';
import {
  linkPatientSchema,
  cancelPortalAppointmentSchema,
} from './portal.validation';

export const portalRouter = Router();
portalRouter.use(authenticate);

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
portalRouter.post('/link-patient',
  validate(linkPatientSchema),
  portalController.linkPatient,
);
