import { Request, Response } from 'express';
import { ReportsService }    from './reports.service';
import { asyncHandler }      from '@/shared/utils/async-handler';

const svc = new ReportsService();

export const reportsController = {
  getKpi:              asyncHandler(async (_req, res) => { res.json({ success: true, data: await svc.getKpiSnapshot() }); }),
  getRevenueByDay:     asyncHandler(async (req,  res) => { res.json({ success: true, data: await svc.getRevenueByDay(Number(req.query.days ?? 30)) }); }),
  getPatientsByDay:    asyncHandler(async (req,  res) => { res.json({ success: true, data: await svc.getPatientsByDay(Number(req.query.days ?? 30)) }); }),
  getApptByStatus:     asyncHandler(async (_req, res) => { res.json({ success: true, data: await svc.getAppointmentsByStatus() }); }),
  getTopDoctors:       asyncHandler(async (req,  res) => { res.json({ success: true, data: await svc.getTopDoctors(Number(req.query.limit ?? 10)) }); }),
  getLabTurnaround:    asyncHandler(async (_req, res) => { res.json({ success: true, data: await svc.getLabTurnaround() }); }),
  getEmergencyByESI:   asyncHandler(async (_req, res) => { res.json({ success: true, data: await svc.getEmergencyByESI() }); }),
  getDrugDispensing:   asyncHandler(async (req,  res) => { res.json({ success: true, data: await svc.getDrugDispensing(Number(req.query.limit ?? 10)) }); }),
  getOutstandingByAge: asyncHandler(async (_req, res) => { res.json({ success: true, data: await svc.getOutstandingByAge() }); }),
  getFullReport:       asyncHandler(async (_req, res) => { res.json({ success: true, data: await svc.getFullReport() }); }),
};
