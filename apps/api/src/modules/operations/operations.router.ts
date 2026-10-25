import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { getDb,withTransaction } from '@/infrastructure/database/db.client';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize,authorizeRoles } from '@/shared/middleware/authorize';
import { validate } from '@/shared/middleware/validate';
import { asyncHandler } from '@/shared/utils/async-handler';
import { ConflictError,NotFoundError,ValidationError } from '@/shared/errors/app-error';

const text=z.string().trim().min(1).max(2000);
const uuid=z.string().uuid();
const kindSchema=z.enum(['theatre','insurance','hr','referral']);
type Kind=z.infer<typeof kindSchema>;
const details:Record<Kind,z.ZodTypeAny>={
  theatre:z.object({room:text,procedure:text,startsAt:z.string().datetime(),endsAt:z.string().datetime(),consentConfirmed:z.boolean().default(false),checklistComplete:z.boolean().default(false),operativeNote:z.string().max(10000).default('')}).strict(),
  insurance:z.object({invoiceId:uuid,payer:text,policyNumber:text,amount:z.number().positive(),payerReference:z.string().max(200).default(''),decisionReason:z.string().max(2000).default('')}).strict(),
  hr:z.object({department:text,startsAt:z.string().datetime(),endsAt:z.string().datetime(),notes:z.string().max(2000).default('')}).strict(),
  referral:z.object({destination:text,reason:text,urgency:z.enum(['routine','urgent']),outcome:z.string().max(10000).default('')}).strict(),
};
const transitions:Record<Kind,Record<string,string[]>>={
  theatre:{requested:['scheduled','cancelled'],scheduled:['in_progress','cancelled'],in_progress:['completed'],completed:[],cancelled:[]},
  insurance:{requested:['submitted','cancelled'],submitted:['approved','denied'],denied:['submitted','cancelled'],approved:['paid'],paid:[],cancelled:[]},
  hr:{requested:['confirmed','cancelled'],confirmed:['completed','cancelled'],completed:[],cancelled:[]},
  referral:{requested:['accepted','declined'],accepted:['completed','declined'],completed:[],declined:[]},
};
const permissions:Record<Kind,string>={theatre:'theatre:manage',insurance:'insurance:manage',hr:'hr:manage',referral:'referrals:manage'};
const taskSchema=z.object({title:text,patientId:uuid.optional(),encounterId:uuid.optional(),assignedTo:uuid.optional(),details:z.record(z.unknown())}).strict();

export const operationsRouter=Router();
operationsRouter.use(authenticate);
operationsRouter.get('/lookups',authorizeRoles('admin','doctor','nurse','accountant','pharmacist','lab_technician','radiologist','receptionist'),asyncHandler(async(req,res)=>{
  const q=z.string().max(100).parse(req.query.q??'');
  const db=getDb();
  const [patients,doctors,users]=await Promise.all([
    db.query(`SELECT id,mrn,first_name,last_name FROM patients.patients WHERE NOT is_deleted AND is_active
      AND (first_name || ' ' || last_name || ' ' || mrn) ILIKE $1 ORDER BY first_name LIMIT 40`,['%'+q+'%']),
    db.query(`SELECT d.id,u.full_name FROM doctors.doctors d JOIN auth.users u ON u.id=d.user_id WHERE u.is_active ORDER BY u.full_name`),
    db.query(`SELECT DISTINCT u.id,u.full_name FROM auth.users u JOIN auth.user_roles ur ON ur.user_id=u.id JOIN auth.roles r ON r.id=ur.role_id WHERE u.is_active AND r.name<>'patient' ORDER BY u.full_name`),
  ]);
  res.json({success:true,data:{patients:patients.rows,doctors:doctors.rows,users:users.rows}});
}));
operationsRouter.use('/tasks/:kind',(req,res,next)=>{
  const kind=kindSchema.safeParse(req.params.kind);
  if(!kind.success) return next(new NotFoundError('Workflow'));
  authorize(permissions[kind.data])(req,res,next);
});
operationsRouter.get('/tasks/:kind',asyncHandler(async(req,res)=>{
  const kind=kindSchema.parse(req.params.kind);
  const {rows}=await getDb().query(`SELECT t.*,p.mrn,p.first_name,p.last_name,u.full_name AS assignee_name,
    COALESCE((SELECT jsonb_agg(e ORDER BY e.created_at) FROM operations.task_events e WHERE e.task_id=t.id),'[]') AS history
    FROM operations.tasks t LEFT JOIN patients.patients p ON p.id=t.patient_id LEFT JOIN auth.users u ON u.id=t.assigned_to
    WHERE kind=$1 ORDER BY t.created_at DESC LIMIT 200`,[kind]);
  res.json({success:true,data:{rows,transitions:transitions[kind]}});
}));
operationsRouter.post('/tasks/:kind',validate(taskSchema),asyncHandler(async(req,res)=>{
  const kind=kindSchema.parse(req.params.kind);
  const data=taskSchema.parse(req.body), value=details[kind].parse(data.details);
  const record=await withTransaction(async client=>{
    if(kind!=='hr'&&!data.patientId) throw new ValidationError([{message:'Select a patient.'}]);
    if(kind==='hr'&&!data.assignedTo) throw new ValidationError([{message:'Assign a staff member.'}]);
    if(data.encounterId){
      const enc=await client.query('SELECT id FROM emr.encounters WHERE id=$1 AND patient_id=$2 AND NOT is_deleted',[data.encounterId,data.patientId]);
      if(!enc.rowCount) throw new ConflictError('Encounter does not belong to this patient.');
    }
    if(kind==='theatre'||kind==='hr'){
      if(new Date(value.endsAt)<=new Date(value.startsAt)) throw new ConflictError('End time must follow start time.');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[kind+':'+(kind==='theatre'?value.room:data.assignedTo)]);
      const conflict=await client.query(`SELECT id FROM operations.tasks WHERE kind=$1 AND status NOT IN ('cancelled','completed')
        AND ($1='theatre' AND details->>'room'=$2 OR $1='hr' AND assigned_to::text=$2)
        AND (details->>'startsAt')::timestamptz<$4::timestamptz AND (details->>'endsAt')::timestamptz>$3::timestamptz`,
        [kind,kind==='theatre'?value.room:data.assignedTo,value.startsAt,value.endsAt]);
      if(conflict.rowCount) throw new ConflictError('This room or staff member already has a booking during that time.');
    }
    if(kind==='insurance'){
      const {rows:[invoice]}=await client.query('SELECT * FROM billing.invoices WHERE id=$1 AND patient_id=$2 FOR UPDATE',[value.invoiceId,data.patientId]);
      if(!invoice) throw new NotFoundError('Patient invoice');
      const {rows:[claims]}=await client.query(`SELECT COALESCE(SUM((details->>'amount')::numeric),0) AS total FROM operations.tasks
        WHERE kind='insurance' AND details->>'invoiceId'=$1 AND status NOT IN ('cancelled','denied')`,[value.invoiceId]);
      if(value.amount+Number(claims.total)>Number(invoice.total_amount)) throw new ConflictError('Claims cannot exceed the invoice total.');
    }
    const {rows:[created]}=await client.query(`INSERT INTO operations.tasks(kind,title,patient_id,encounter_id,assigned_to,details,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[kind,data.title,data.patientId??null,data.encounterId??null,data.assignedTo??null,value,req.user!.id]);
    await client.query("INSERT INTO operations.task_events(task_id,status,note,actor_id) VALUES($1,'requested','Created',$2)",[created.id,req.user!.id]);
    return created;
  });
  res.status(201).json({success:true,data:record});
}));
operationsRouter.post('/tasks/:kind/:id/transition',validate(z.object({status:text,note:text,details:z.record(z.unknown()).default({})}).strict()),asyncHandler(async(req,res)=>{
  const kind=kindSchema.parse(req.params.kind),id=uuid.parse(req.params.id);
  const record=await withTransaction(async client=>{
    const {rows:[current]}=await client.query('SELECT * FROM operations.tasks WHERE id=$1 AND kind=$2 FOR UPDATE',[id,kind]);
    if(!current) throw new NotFoundError('Workflow');
    if(!transitions[kind][current.status]?.includes(req.body.status)) throw new ConflictError('That status change is not available.');
    const allowed:Record<Kind,string[]>={theatre:['consentConfirmed','checklistComplete','operativeNote'],insurance:['payerReference','decisionReason'],hr:['notes'],referral:['outcome']};
    if(Object.keys(req.body.details).some(key=>!allowed[kind].includes(key))) throw new ConflictError('Booking and financial details cannot be changed during a status transition.');
    const value=details[kind].parse({...current.details,...req.body.details});
    if(kind==='theatre'&&req.body.status==='in_progress'&&(!value.consentConfirmed||!value.checklistComplete)) throw new ConflictError('Confirm consent and complete the surgical safety checklist first.');
    if(kind==='theatre'&&req.body.status==='completed'&&!value.operativeNote.trim()) throw new ConflictError('An operative note is required.');
    if(kind==='insurance'&&['submitted','approved','paid'].includes(req.body.status)&&!value.payerReference.trim()) throw new ConflictError('Record the payer submission, decision, or remittance reference.');
    if(kind==='insurance'&&req.body.status==='denied'&&!value.decisionReason.trim()) throw new ConflictError('Record the denial reason.');
    if(kind==='referral'&&req.body.status==='completed'&&!value.outcome.trim()) throw new ConflictError('Record the referral outcome.');
    const {rows:[updated]}=await client.query('UPDATE operations.tasks SET status=$2,details=$3,updated_at=NOW() WHERE id=$1 RETURNING *',[id,req.body.status,value]);
    await client.query('INSERT INTO operations.task_events(task_id,status,note,actor_id) VALUES($1,$2,$3,$4)',[id,req.body.status,req.body.note,req.user!.id]);
    return updated;
  });
  res.json({success:true,data:record});
}));

operationsRouter.get('/supplies',authorize('inventory:manage'),asyncHandler(async(_req,res)=>{res.json({success:true,data:(await getDb().query('SELECT * FROM operations.supplies ORDER BY name')).rows});}));
operationsRouter.post('/supplies',authorize('inventory:manage'),validate(z.object({sku:text,name:text,unit:text,location:text,reorderLevel:z.number().nonnegative()})),asyncHandler(async(req,res)=>{
  const d=req.body;
  res.status(201).json({success:true,data:(await getDb().query('INSERT INTO operations.supplies(sku,name,unit,location,reorder_level) VALUES($1,$2,$3,$4,$5) RETURNING *',[d.sku,d.name,d.unit,d.location,d.reorderLevel])).rows[0]});
}));
operationsRouter.get('/supplies/:id/movements',authorize('inventory:manage'),asyncHandler(async(req,res)=>{res.json({success:true,data:(await getDb().query('SELECT * FROM operations.stock_movements WHERE supply_id=$1 ORDER BY created_at DESC LIMIT 200',[uuid.parse(req.params.id)])).rows});}));
operationsRouter.post('/supplies/:id/movements',authorize('inventory:manage'),validate(z.object({quantity:z.number().finite().refine(n=>n!==0),reason:text,reference:text})),asyncHandler(async(req,res)=>{
  const record=await withTransaction(async client=>{
    const {rows:[supply]}=await client.query('SELECT * FROM operations.supplies WHERE id=$1 FOR UPDATE',[uuid.parse(req.params.id)]);
    if(!supply) throw new NotFoundError('Supply');
    if(Number(supply.quantity)+req.body.quantity<0) throw new ConflictError('Insufficient stock.');
    await client.query('INSERT INTO operations.stock_movements(supply_id,quantity,reason,reference,actor_id) VALUES($1,$2,$3,$4,$5)',[supply.id,req.body.quantity,req.body.reason,req.body.reference,req.user!.id]);
    return (await client.query('UPDATE operations.supplies SET quantity=quantity+$2 WHERE id=$1 RETURNING *',[supply.id,req.body.quantity])).rows[0];
  });
  res.json({success:true,data:record});
}));

operationsRouter.get('/documents',authorize('documents:manage'),asyncHandler(async(req,res)=>{
  const patientId=uuid.parse(req.query.patientId);
  res.json({success:true,data:(await getDb().query('SELECT id,patient_id,title,filename,mime_type,sha256,created_at FROM operations.documents WHERE patient_id=$1 ORDER BY created_at DESC',[patientId])).rows});
}));
operationsRouter.post('/documents',authorize('documents:manage'),validate(z.object({patientId:uuid,title:text,filename:z.string().max(200).regex(/^[\w .-]+$/),mimeType:z.enum(['application/pdf','image/png','image/jpeg']),content:z.string().max(7_000_000)})),asyncHandler(async(req,res)=>{
  const d=req.body,content=Buffer.from(d.content,'base64');
  const signature=d.mimeType==='application/pdf'?content.subarray(0,5).toString()==='%PDF-':d.mimeType==='image/png'?content.subarray(0,8).toString('hex')==='89504e470d0a1a0a':content.subarray(0,3).toString('hex')==='ffd8ff';
  if(!content.length||content.length>5_000_000||!signature) throw new ValidationError([{message:'Select a valid PDF, PNG, or JPEG up to 5 MB.'}]);
  const {rows:[record]}=await getDb().query(`INSERT INTO operations.documents(patient_id,title,filename,mime_type,content,sha256,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,filename`,[d.patientId,d.title,d.filename,d.mimeType,content,createHash('sha256').update(content).digest('hex'),req.user!.id]);
  res.status(201).json({success:true,data:record});
}));
operationsRouter.get('/documents/:id/download',authorize('documents:manage'),asyncHandler(async(req,res)=>{
  const {rows:[record]}=await getDb().query('SELECT * FROM operations.documents WHERE id=$1',[uuid.parse(req.params.id)]);
  if(!record) throw new NotFoundError('Document');
  await getDb().query("INSERT INTO audit.emr_access_logs(user_id,patient_id,access_type) VALUES($1,$2,'export')",[req.user!.id,record.patient_id]);
  res.setHeader('Content-Disposition',`attachment; filename="${record.filename}"`);
  res.setHeader('Cache-Control','no-store');
  res.type(record.mime_type).send(record.content);
}));
