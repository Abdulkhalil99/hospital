import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { validate } from '@/shared/middleware/validate';
import { asyncHandler } from '@/shared/utils/async-handler';
import { getDb } from '@/infrastructure/database/db.client';
import { inpatientCare } from './inpatient.care';

export const inpatientRouter=Router();
inpatientRouter.use(authenticate);
inpatientRouter.get('/beds',authorize('inpatient:read'),asyncHandler(async(_req,res)=>{res.json({success:true,data:await inpatientCare.beds()});}));
inpatientRouter.post('/beds',authorize('operations:manage'),validate(z.object({ward:z.string().trim().min(1).max(100),label:z.string().trim().min(1).max(50)})),asyncHandler(async(req,res)=>{
  const {rows:[bed]}=await getDb().query('INSERT INTO inpatient.beds(ward,label) VALUES($1,$2) RETURNING *',[req.body.ward,req.body.label]);
  res.status(201).json({success:true,data:bed});
}));
inpatientRouter.get('/',authorize('inpatient:read'),asyncHandler(async(_req,res)=>{res.json({success:true,data:await inpatientCare.list()});}));
inpatientRouter.post('/',authorize('inpatient:write'),validate(z.object({patientId:z.string().uuid(),doctorId:z.string().uuid(),bedId:z.string().uuid(),reason:z.string().trim().min(1).max(2000)})),asyncHandler(async(req,res)=>{res.status(201).json({success:true,data:await inpatientCare.admit(req.body,req.user!.id)});}));
inpatientRouter.get('/:id',authorize('inpatient:read'),asyncHandler(async(req,res)=>{res.json({success:true,data:await inpatientCare.detail(z.string().uuid().parse(req.params.id))});}));
inpatientRouter.post('/:id/transfer',authorize('inpatient:write'),validate(z.object({bedId:z.string().uuid(),reason:z.string().trim().min(1).max(1000)})),asyncHandler(async(req,res)=>{res.json({success:true,data:await inpatientCare.transfer(req.params.id,req.body.bedId,req.body.reason,req.user!.id)});}));
inpatientRouter.post('/:id/reconcile',authorize('inpatient:write'),validate(z.object({phase:z.enum(['admission','discharge']),notes:z.string().trim().min(1).max(5000),medications:z.array(z.object({name:z.string().trim().min(1).max(200),dose:z.string().trim().min(1).max(100),action:z.enum(['continue','stop','change','start']),instructions:z.string().max(1000)})).max(100)})),asyncHandler(async(req,res)=>{res.status(201).json({success:true,data:await inpatientCare.reconcile(req.params.id,req.body,req.user!.id)});}));
inpatientRouter.post('/:id/administrations',authorize('inpatient:administer'),validate(z.object({prescriptionId:z.string().uuid(),patientMrn:z.string().min(1),scheduledAt:z.string().datetime(),status:z.enum(['given','held','refused']),dose:z.string().min(1).max(100),route:z.string().min(1).max(50),reason:z.string().max(1000).optional(),witnessId:z.string().uuid().optional()})),asyncHandler(async(req,res)=>{res.status(201).json({success:true,data:await inpatientCare.administer(req.params.id,req.body,req.user!.id)});}));
inpatientRouter.post('/:id/discharge',authorize('inpatient:write'),validate(z.object({summary:z.string().trim().min(10).max(20000),followUp:z.string().trim().min(1).max(5000),pendingResultsPlan:z.string().max(5000).default('')})),asyncHandler(async(req,res)=>{res.json({success:true,data:await inpatientCare.discharge(req.params.id,req.body,req.user!.id)});}));
