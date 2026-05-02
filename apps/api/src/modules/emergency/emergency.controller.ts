import { Request, Response }  from 'express';
import { EmergencyService }   from './emergency.service';
import { asyncHandler }       from '@/shared/utils/async-handler';

const svc = new EmergencyService();

export const emergencyController = {

  registerVisit: asyncHandler(async (req, res) => {
    const visit = await svc.registerVisit(req.body, req.user!.id);
    res.status(201).json({ success: true, data: visit });
  }),

  getVisitById: asyncHandler(async (req, res) => {
    const visit = await svc.getVisitById(req.params.id);
    res.json({ success: true, data: visit });
  }),

  getDashboard: asyncHandler(async (_req, res) => {
    const data = await svc.getDashboard();
    res.json({ success: true, data });
  }),

  updateVisitStatus: asyncHandler(async (req, res) => {
    const updated = await svc.updateVisitStatus(req.body, req.user!.id);
    res.json({ success: true, data: updated });
  }),

  // Triage
  performTriage: asyncHandler(async (req, res) => {
    const triage = await svc.performTriage(req.body, req.user!.id);
    res.status(201).json({ success: true, data: triage });
  }),

  getTriageByVisit: asyncHandler(async (req, res) => {
    const data = await svc.getTriageByVisit(req.params.visitId);
    res.json({ success: true, data });
  }),

  // Beds
  getAvailableBeds: asyncHandler(async (_req, res) => {
    const data = await svc.getAvailableBeds();
    res.json({ success: true, data });
  }),

  getBedBoard: asyncHandler(async (_req, res) => {
    const data = await svc.getBedBoard();
    res.json({ success: true, data });
  }),

  assignBed: asyncHandler(async (req, res) => {
    const data = await svc.assignBed(req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  }),

  // Trauma
  activateTrauma: asyncHandler(async (req, res) => {
    const data = await svc.activateTrauma(req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  }),

  getTraumaActivations: asyncHandler(async (req, res) => {
    const data = await svc.getTraumaActivations(
      req.query.visitId as string | undefined,
    );
    res.json({ success: true, data });
  }),

  getTodayStats: asyncHandler(async (_req, res) => {
    const data = await svc.getTodayStats();
    res.json({ success: true, data });
  }),
};
