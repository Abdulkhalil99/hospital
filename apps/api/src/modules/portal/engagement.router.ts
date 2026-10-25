import { Router,RequestHandler } from 'express';
import { z } from 'zod';
import { createHmac,randomInt,randomUUID,timingSafeEqual } from 'crypto';
import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { getDb,withTransaction } from '@/infrastructure/database/db.client';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { validate } from '@/shared/middleware/validate';
import { asyncHandler } from '@/shared/utils/async-handler';
import { ConflictError,NotFoundError,UnauthorizedError } from '@/shared/errors/app-error';
import { PortalRepository } from './portal.repository';
import { linkPatientSchema } from './portal.validation';
import { AppointmentsService } from '@/modules/appointments/appointments.service';
import { AvailabilityEngine } from '@/modules/doctors/availability.engine';
import { createAppointmentSchema } from '@/modules/appointments/appointments.validation';
import { sendSms } from '@/modules/notifications/channels/sms.channel';

const uuid=z.string().uuid(),repo=new PortalRepository(),appointments=new AppointmentsService(),engine=new AvailabilityEngine();
const digest=(id:string,code:string)=>createHmac('sha256',config.jwt.secret).update(id+':'+code).digest('hex');
async function patient(user:string){const p=await repo.getPatientByUserId(user);if(!p||!p.is_active)throw new NotFoundError('Linked patient');return p;}
const hospitalToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:process.env.HOSPITAL_TIMEZONE??'Asia/Kabul'}).format(new Date());
export const engagementRouter=Router();
engagementRouter.use(authenticate);
engagementRouter.post('/link-challenges',rateLimit({windowMs:15*60*1000,max:5}),validate(linkPatientSchema),asyncHandler(async(req,res)=>{
  const p=await repo.findPatientForPortalLink(req.body),id=randomUUID();
  // Identical responses prevent callers from enumerating registered patients.
  if(p?.phone&&!p.portal_user_id){
    const code=String(randomInt(100000,1000000));
    await getDb().query("INSERT INTO patients.portal_link_challenges(id,user_id,patient_id,code_hash,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')",[id,req.user!.id,p.id,digest(id,code)]);
    const delivery=await sendSms(p.phone,`MediCore verification code: ${code}. Expires in 10 minutes.`);
    if(!delivery.success)await getDb().query('UPDATE patients.portal_link_challenges SET used_at=NOW() WHERE id=$1',[id]);
  }
  res.json({success:true,data:{challengeId:id,message:'If the details match an unlinked record, a code has been sent to the registered phone.'}});
}));
export const verifyPortalLink:RequestHandler=asyncHandler(async(req,_res,next)=>{
  const {challengeId,code}=z.object({challengeId:uuid,code:z.string().regex(/^\d{6}$/)}).parse(req.body);
  const identity=linkPatientSchema.parse(req.body),p=await repo.findPatientForPortalLink(identity);
  const ok=await withTransaction(async client=>{
    const {rows:[challenge]}=await client.query('SELECT * FROM patients.portal_link_challenges WHERE id=$1 AND user_id=$2 FOR UPDATE',[challengeId,req.user!.id]);
    if(!challenge||challenge.used_at||challenge.attempts>=5||new Date(challenge.expires_at)<=new Date())return false;
    await client.query('UPDATE patients.portal_link_challenges SET attempts=attempts+1 WHERE id=$1',[challengeId]);
    if(!p||p.id!==challenge.patient_id||!timingSafeEqual(Buffer.from(challenge.code_hash,'hex'),Buffer.from(digest(challengeId,code),'hex')))return false;
    await client.query('UPDATE patients.portal_link_challenges SET used_at=NOW() WHERE id=$1',[challengeId]);return true;
  });
  if(!ok)throw new UnauthorizedError('Invalid or expired verification code.');
  next();
});
engagementRouter.get('/booking-options',asyncHandler(async(req,res)=>{
  await patient(req.user!.id);
  const doctors=await getDb().query(`SELECT d.id,u.full_name FROM doctors.doctors d JOIN auth.users u ON u.id=d.user_id WHERE u.is_active AND d.is_active ORDER BY u.full_name`);
  res.json({success:true,data:{doctors:doctors.rows,types:await appointments.getTypes()}});
}));
engagementRouter.get('/availability',asyncHandler(async(req,res)=>{
  await patient(req.user!.id);const q=z.object({doctorId:uuid,date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(req.query);
  res.json({success:true,data:await engine.getForDate(q.doctorId,q.date)});
}));
const booking=createAppointmentSchema.omit({patientId:true,isWalkIn:true});
engagementRouter.post('/appointments',validate(booking),asyncHandler(async(req,res)=>{
  const p=await patient(req.user!.id);
  if(req.body.scheduledDate<hospitalToday())throw new ConflictError('Choose today or a future date.');
  res.status(201).json({success:true,data:await appointments.book({...req.body,patientId:p.id,isWalkIn:false},req.user!.id)});
}));
engagementRouter.post('/appointments/:id/reschedule',validate(booking.pick({scheduledDate:true,scheduledStart:true})),asyncHandler(async(req,res)=>{
  const p=await patient(req.user!.id),id=uuid.parse(req.params.id),current=await appointments.getById(id);
  if(current.patient_id!==p.id)throw new NotFoundError('Appointment');
  if(req.body.scheduledDate<hospitalToday())throw new ConflictError('Choose today or a future date.');
  const available=await engine.getForDate(current.doctor_id,req.body.scheduledDate),slot=available.slots.find(s=>s.startTime===req.body.scheduledStart);
  if(!slot||!available.isWorkDay||available.isOnLeave||available.isHoliday)throw new ConflictError('Choose an available appointment slot.');
  const updated=await withTransaction(async client=>{
    await client.query('SELECT id FROM doctors.doctors WHERE id=$1 FOR UPDATE',[current.doctor_id]);
    const {rows:[a]}=await client.query('SELECT * FROM appointments.appointments WHERE id=$1 FOR UPDATE',[id]);
    if(!a||!['scheduled','confirmed'].includes(a.status))throw new ConflictError('Only scheduled appointments can be moved.');
    const {rows:[count]}=await client.query(`SELECT COUNT(*) FROM appointments.appointments WHERE doctor_id=$1 AND scheduled_date=$2 AND scheduled_start=$3
      AND id<>$4 AND status NOT IN ('cancelled','no_show') AND NOT is_deleted`,[a.doctor_id,req.body.scheduledDate,req.body.scheduledStart,id]);
    if(Number(count.count)>=slot.maxPatients)throw new ConflictError('This slot is fully booked.');
    return (await client.query(`UPDATE appointments.appointments SET scheduled_date=$2,scheduled_start=$3,scheduled_end=$4,status='scheduled',updated_at=NOW() WHERE id=$1 RETURNING *`,[id,req.body.scheduledDate,req.body.scheduledStart,slot.endTime])).rows[0];
  });
  res.json({success:true,data:updated});
}));
engagementRouter.post('/appointments/:id/checkin',asyncHandler(async(req,res)=>{
  const p=await patient(req.user!.id),a=await appointments.getById(uuid.parse(req.params.id));
  if(a.patient_id!==p.id)throw new NotFoundError('Appointment');
  const date=typeof a.scheduled_date==='string'?String(a.scheduled_date).slice(0,10):new Intl.DateTimeFormat('en-CA').format(a.scheduled_date);
  if(date!==hospitalToday())throw new ConflictError('Check-in is available on the appointment date.');
  res.json({success:true,data:await appointments.checkin(a.id,req.user!.id)});
}));

const message=z.object({body:z.string().trim().min(1).max(10000)});
async function listThreads(patientId?:string){return (await getDb().query(`SELECT t.*,p.mrn,p.first_name,p.last_name,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'sender_id',m.sender_id,'sender_name',u.full_name,'created_at',m.created_at) ORDER BY m.created_at)
    FROM patients.messages m JOIN auth.users u ON u.id=m.sender_id WHERE m.thread_id=t.id),'[]') AS messages
  FROM patients.message_threads t JOIN patients.patients p ON p.id=t.patient_id WHERE ($1::uuid IS NULL OR t.patient_id=$1)
  ORDER BY t.created_at DESC LIMIT 100`,[patientId??null])).rows;}
async function reply(id:string,body:string,user:string,patientId?:string){return withTransaction(async client=>{
  const {rows:[thread]}=await client.query('SELECT * FROM patients.message_threads WHERE id=$1 FOR UPDATE',[id]);
  if(!thread||(patientId&&thread.patient_id!==patientId))throw new NotFoundError('Conversation');
  if(thread.status==='closed')throw new ConflictError('This conversation is closed. Start a new message.');
  return (await client.query('INSERT INTO patients.messages(thread_id,sender_id,body) VALUES($1,$2,$3) RETURNING *',[id,user,body])).rows[0];
});}
engagementRouter.get('/messages',asyncHandler(async(req,res)=>{res.json({success:true,data:await listThreads((await patient(req.user!.id)).id)});}));
engagementRouter.post('/messages',validate(message.extend({subject:z.string().trim().min(1).max(200)})),asyncHandler(async(req,res)=>{
  const p=await patient(req.user!.id);
  const thread=await withTransaction(async client=>{
    const {rows:[t]}=await client.query('INSERT INTO patients.message_threads(patient_id,subject) VALUES($1,$2) RETURNING *',[p.id,req.body.subject]);
    await client.query('INSERT INTO patients.messages(thread_id,sender_id,body) VALUES($1,$2,$3)',[t.id,req.user!.id,req.body.body]);return t;
  });res.status(201).json({success:true,data:thread});
}));
engagementRouter.post('/messages/:id/replies',validate(message),asyncHandler(async(req,res)=>{res.status(201).json({success:true,data:await reply(uuid.parse(req.params.id),req.body.body,req.user!.id,(await patient(req.user!.id)).id)});}));
export const careMessagesRouter=Router();
careMessagesRouter.use(authenticate);
careMessagesRouter.get('/',authorize('messages:read'),asyncHandler(async(_req,res)=>{res.json({success:true,data:await listThreads()});}));
careMessagesRouter.post('/:id/replies',authorize('messages:write'),validate(message),asyncHandler(async(req,res)=>{res.status(201).json({success:true,data:await reply(uuid.parse(req.params.id),req.body.body,req.user!.id)});}));
careMessagesRouter.post('/:id/close',authorize('messages:write'),asyncHandler(async(req,res)=>{
  const {rows:[thread]}=await getDb().query("UPDATE patients.message_threads SET status='closed' WHERE id=$1 RETURNING *",[uuid.parse(req.params.id)]);
  if(!thread)throw new NotFoundError('Conversation');res.json({success:true,data:thread});
}));
