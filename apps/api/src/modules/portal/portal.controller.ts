import { Request, Response } from 'express';
import { PortalService }     from './portal.service';
import { asyncHandler }      from '@/shared/utils/async-handler';

const svc = new PortalService();

export const portalController = {
  getProfile:       asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getMyProfile(req.user!.id) }); }),
  getMedicalSummary:asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getMedicalSummary(req.user!.id) }); }),
  getAppointments:  asyncHandler(async (req, res) => {
    const upcoming = req.query.upcoming === 'true';
    res.json({ success: true, data: await svc.getMyAppointments(req.user!.id, upcoming) });
  }),
  cancelAppointment: asyncHandler(async (req, res) => {
    const result = await svc.cancelMyAppointment(
      req.user!.id,
      req.params.appointmentId,
      req.body.reason,
    );
    res.json({ success: true, data: result });
  }),
  getLabResults:    asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getMyLabResults(req.user!.id) }); }),
  getPrescriptions: asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getMyPrescriptions(req.user!.id) }); }),
  getInvoices:      asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getMyInvoices(req.user!.id) }); }),
  getInvoiceDetail: asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getMyInvoiceDetail(req.user!.id, req.params.invoiceId) }); }),
  getAllergies:      asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getMyAllergies(req.user!.id) }); }),
  linkPatient:      asyncHandler(async (req, res) => {
    const patient = await svc.linkPatient(req.user!.id, req.body);
    res.json({ success: true, data: { message: 'Patient record linked to your account.', patient } });
  }),
};
