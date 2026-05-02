import { Request, Response }    from 'express';
import { LaboratoryService }    from './laboratory.service';
import { asyncHandler }         from '@/shared/utils/async-handler';

const svc = new LaboratoryService();

export const laboratoryController = {

  // Test catalog
  getTestCatalog: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.getTestCatalog() });
  }),

  getTestWithRanges: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getTestWithRanges(req.params.id) });
  }),

  // Worklist
  getWorklist: asyncHandler(async (req, res) => {
    const { status, urgency, date } = req.query as Record<string, string>;
    res.json({ success: true, data: await svc.getWorklist({ status, urgency, date }) });
  }),

  getOrderById: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getOrderById(req.params.id) });
  }),

  // Sample management
  collectSample: asyncHandler(async (req, res) => {
    const sample = await svc.collectSample(req.body, req.user!.id);
    res.status(201).json({ success: true, data: sample });
  }),

  receiveSample: asyncHandler(async (req, res) => {
    const sample = await svc.receiveSample(req.body, req.user!.id);
    res.json({ success: true, data: sample });
  }),

  rejectSample: asyncHandler(async (req, res) => {
    const result = await svc.rejectSample(req.body, req.user!.id);
    res.json({ success: true, data: result });
  }),

  // Results
  enterResults: asyncHandler(async (req, res) => {
    const results = await svc.enterResults(req.body, req.user!.id);
    res.status(201).json({ success: true, data: results });
  }),

  validateResults: asyncHandler(async (req, res) => {
    const result = await svc.validateResults(req.body.resultIds, req.user!.id);
    res.json({ success: true, data: result });
  }),

  releaseResults: asyncHandler(async (req, res) => {
    const result = await svc.releaseResults(req.body.resultIds, req.user!.id);
    res.json({ success: true, data: result });
  }),

  getResultsBySample: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getResultsBySample(req.params.sampleId) });
  }),

  getResultsByOrder: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getResultsByOrder(req.params.orderId) });
  }),

  getResultsByPatient: asyncHandler(async (req, res) => {
    const released = req.query.released === 'true';
    res.json({ success: true, data: await svc.getResultsByPatient(req.params.patientId, released) });
  }),

  // Critical alerts
  getPendingCriticalAlerts: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.getPendingCriticalAlerts() });
  }),

  acknowledgeCriticalAlert: asyncHandler(async (req, res) => {
    await svc.acknowledgeCriticalAlert(req.params.alertId, req.user!.id, req.body.note);
    res.json({ success: true, data: { message: 'Alert acknowledged.' } });
  }),
};
