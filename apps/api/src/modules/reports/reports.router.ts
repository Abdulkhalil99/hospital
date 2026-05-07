import { Router }            from 'express';
import { reportsController } from './reports.controller';
import { authenticate }      from '@/shared/middleware/authenticate';
import { authorize }         from '@/shared/middleware/authorize';

export const reportsRouter = Router();
reportsRouter.use(authenticate);
reportsRouter.use(authorize('report:view'));

reportsRouter.get('/kpi',           reportsController.getKpi);
reportsRouter.get('/revenue',       reportsController.getRevenueByDay);
reportsRouter.get('/patients',      reportsController.getPatientsByDay);
reportsRouter.get('/appointments',  reportsController.getApptByStatus);
reportsRouter.get('/doctors',       reportsController.getTopDoctors);
reportsRouter.get('/lab',           reportsController.getLabTurnaround);
reportsRouter.get('/emergency',     reportsController.getEmergencyByESI);
reportsRouter.get('/drugs',         reportsController.getDrugDispensing);
reportsRouter.get('/outstanding',   reportsController.getOutstandingByAge);
reportsRouter.get('/full',          reportsController.getFullReport);
