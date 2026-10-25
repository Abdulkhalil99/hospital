import { Router } from 'express';
import { z } from 'zod';
import { getDb,withTransaction } from '@/infrastructure/database/db.client';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { validate } from '@/shared/middleware/validate';
import { asyncHandler } from '@/shared/utils/async-handler';
import { ConflictError,NotFoundError } from '@/shared/errors/app-error';

export const radiologyRouter=Router();
radiologyRouter.use(authenticate);
radiologyRouter.get('/',authorize('radiology:read'),asyncHandler(async(_req,res)=>{
  res.json({success:true,data:(await getDb().query(`SELECT o.*,p.mrn,p.first_name,p.last_name FROM emr.imaging_orders o JOIN patients.patients p ON p.id=o.patient_id ORDER BY o.created_at DESC LIMIT 200`)).rows});
}));
radiologyRouter.post('/:id/transition',authorize('radiology:write'),validate(z.object({status:z.enum(['scheduled','performed','reported','cancelled']),scheduledAt:z.string().datetime().optional(),studyUid:z.string().max(64).regex(/^[0-9]+(\.[0-9]+)*$/).optional(),reportText:z.string().trim().min(1).max(20000).optional()})),asyncHandler(async(req,res)=>{
  const record=await withTransaction(async client=>{
    const {rows:[current]}=await client.query('SELECT * FROM emr.imaging_orders WHERE id=$1 FOR UPDATE',[z.string().uuid().parse(req.params.id)]);
    if(!current) throw new NotFoundError('Imaging order');
    const transitions:Record<string,string[]>={ordered:['scheduled','cancelled'],scheduled:['performed','cancelled'],performed:['reported'],reported:[],cancelled:[]};
    if(!transitions[current.status]?.includes(req.body.status)) throw new ConflictError('That imaging status change is not available.');
    if(req.body.status==='scheduled'&&!req.body.scheduledAt) throw new ConflictError('Select a scan time.');
    if(req.body.status==='reported'&&!req.body.reportText) throw new ConflictError('Enter the signed report.');
    return (await client.query(`UPDATE emr.imaging_orders SET status=$2,scheduled_at=COALESCE($3,scheduled_at),study_uid=COALESCE($4,study_uid),
      report_text=COALESCE($5,report_text),reported_by=CASE WHEN $2='reported' THEN $6 ELSE reported_by END,
      reported_at=CASE WHEN $2='reported' THEN NOW() ELSE reported_at END,updated_at=NOW() WHERE id=$1 RETURNING *`,
      [current.id,req.body.status,req.body.scheduledAt??null,req.body.studyUid??null,req.body.reportText??null,req.user!.id])).rows[0];
  });
  res.json({success:true,data:record});
}));
