import { PoolClient } from 'pg';
import { getDb, withTransaction } from '@/infrastructure/database/db.client';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';

async function admission(client: PoolClient, id: string) {
  const { rows: [row] } = await client.query('SELECT * FROM inpatient.admissions WHERE id=$1 FOR UPDATE', [id]);
  if (!row) throw new NotFoundError('Admission');
  if (row.status !== 'admitted') throw new ConflictError('This admission has been discharged.');
  return row;
}
async function occupy(client: PoolClient, bedId: string) {
  const { rows: [bed] } = await client.query('SELECT * FROM inpatient.beds WHERE id=$1 FOR UPDATE', [bedId]);
  if (!bed) throw new NotFoundError('Bed');
  const { rowCount } = await client.query("SELECT id FROM inpatient.admissions WHERE bed_id=$1 AND status='admitted'", [bedId]);
  if (!bed.available || rowCount) throw new ConflictError('This bed is unavailable or occupied.');
}
async function event(client: PoolClient, id: string, type: string, detail: unknown, actor: string) {
  await client.query('INSERT INTO inpatient.events(admission_id,event_type,detail,actor_id) VALUES($1,$2,$3,$4)', [id,type,JSON.stringify(detail),actor]);
}
export const inpatientCare = {
  async beds() {
    return (await getDb().query(`SELECT b.*,a.id AS admission_id,p.mrn,p.first_name,p.last_name
      FROM inpatient.beds b LEFT JOIN inpatient.admissions a ON a.bed_id=b.id AND a.status='admitted'
      LEFT JOIN patients.patients p ON p.id=a.patient_id ORDER BY b.ward,b.label`)).rows;
  },
  async list() {
    return (await getDb().query(`SELECT a.*,p.mrn,p.first_name,p.last_name,b.ward,b.label AS bed_label
      FROM inpatient.admissions a JOIN patients.patients p ON p.id=a.patient_id JOIN inpatient.beds b ON b.id=a.bed_id
      ORDER BY (a.status='admitted') DESC,a.admitted_at DESC LIMIT 200`)).rows;
  },
  async detail(id: string) {
    const db=getDb();
    const { rows:[record] } = await db.query(`SELECT a.*,p.mrn,p.first_name,p.last_name,b.ward,b.label AS bed_label
      FROM inpatient.admissions a JOIN patients.patients p ON p.id=a.patient_id JOIN inpatient.beds b ON b.id=a.bed_id WHERE a.id=$1`,[id]);
    if (!record) throw new NotFoundError('Admission');
    const [events,reconciliations,administrations,prescriptions,results] = await Promise.all([
      db.query('SELECT e.*,u.full_name AS actor_name FROM inpatient.events e JOIN auth.users u ON u.id=e.actor_id WHERE admission_id=$1 ORDER BY created_at DESC',[id]),
      db.query('SELECT * FROM inpatient.reconciliations WHERE admission_id=$1 ORDER BY recorded_at DESC',[id]),
      db.query(`SELECT a.*,p.drug_name,u.full_name AS staff_name FROM inpatient.administrations a
        JOIN emr.prescriptions p ON p.id=a.prescription_id JOIN auth.users u ON u.id=a.administered_by
        WHERE admission_id=$1 ORDER BY scheduled_at DESC`,[id]),
      db.query('SELECT * FROM emr.prescriptions WHERE encounter_id=$1 ORDER BY created_at DESC',[record.encounter_id]),
      db.query(`SELECT o.id,o.test_name,o.status,COALESCE(jsonb_agg(r) FILTER(WHERE r.id IS NOT NULL),'[]') AS results
        FROM emr.lab_orders o LEFT JOIN laboratory.lab_results r ON r.order_id=o.id
        WHERE o.encounter_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`,[record.encounter_id]),
    ]);
    return {...record,events:events.rows,reconciliations:reconciliations.rows,administrations:administrations.rows,prescriptions:prescriptions.rows,labOrders:results.rows};
  },
  async admit(data: {patientId:string;doctorId:string;bedId:string;reason:string}, actor:string) {
    return withTransaction(async client=>{
      const { rows:[patient] } = await client.query('SELECT id FROM patients.patients WHERE id=$1 AND NOT is_deleted AND is_active FOR UPDATE',[data.patientId]);
      if (!patient) throw new NotFoundError('Active patient');
      if ((await client.query("SELECT id FROM inpatient.admissions WHERE patient_id=$1 AND status='admitted'",[data.patientId])).rowCount) throw new ConflictError('Patient already admitted.');
      await occupy(client,data.bedId);
      const { rows:[encounter] } = await client.query(`INSERT INTO emr.encounters(patient_id,doctor_id,encounter_type,chief_complaint,created_by)
        VALUES($1,$2,'inpatient',$3,$4) RETURNING id`,[data.patientId,data.doctorId,data.reason,actor]);
      const { rows:[record] } = await client.query(`INSERT INTO inpatient.admissions(patient_id,encounter_id,bed_id,reason,created_by)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,[data.patientId,encounter.id,data.bedId,data.reason,actor]);
      await event(client,record.id,'admitted',data,actor);
      return record;
    });
  },
  async transfer(id:string,bedId:string,reason:string,actor:string) {
    return withTransaction(async client=>{
      const current=await admission(client,id);
      await occupy(client,bedId);
      await client.query('UPDATE inpatient.admissions SET bed_id=$2 WHERE id=$1',[id,bedId]);
      await event(client,id,'transferred',{from:current.bed_id,to:bedId,reason},actor);
      return {id,bed_id:bedId};
    });
  },
  async reconcile(id:string,data:{phase:string;medications:unknown[];notes:string},actor:string) {
    return withTransaction(async client=>{
      await admission(client,id);
      const { rows:[record] }=await client.query(`INSERT INTO inpatient.reconciliations(admission_id,phase,medications,notes,recorded_by)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,[id,data.phase,JSON.stringify(data.medications),data.notes,actor]);
      await event(client,id,'medications_reconciled',{phase:data.phase},actor);
      return record;
    });
  },
  async administer(id:string,data:{prescriptionId:string;patientMrn:string;scheduledAt:string;status:string;dose:string;route:string;reason?:string;witnessId?:string},actor:string) {
    return withTransaction(async client=>{
      const current=await admission(client,id);
      const { rows:[rx] }=await client.query(`SELECT r.*,p.mrn FROM emr.prescriptions r JOIN patients.patients p ON p.id=r.patient_id WHERE r.id=$1 FOR UPDATE OF r`,[data.prescriptionId]);
      if (!rx || rx.encounter_id!==current.encounter_id || rx.patient_id!==current.patient_id) throw new NotFoundError('Prescription for this admission');
      if(rx.mrn!==data.patientMrn.trim()) throw new ConflictError('Patient wristband/MRN does not match this admission.');
      if(rx.status==='cancelled') throw new ConflictError('The prescription has been cancelled.');
      if(data.status==='given' && rx.status!=='dispensed') throw new ConflictError('Pharmacy must dispense the prescription first.');
      if(data.dose!==rx.dosage || data.route!==rx.route) throw new ConflictError('Dose and route must match the prescription. Ask the prescriber to update the order.');
      if(data.status!=='given' && !data.reason?.trim()) throw new ConflictError('Record a reason for holding or refusing a medication.');
      if(new Date(data.scheduledAt).getTime() > Date.now()+5*60*1000) throw new ConflictError('Cannot record a future dose.');
      if(new Date(data.scheduledAt)<new Date(current.admitted_at)) throw new ConflictError('Dose time precedes admission.');
      if(rx.is_controlled && data.status==='given') {
        if(!data.witnessId || data.witnessId===actor) throw new ConflictError('A second staff member must witness controlled medication administration.');
        const witness=await client.query(`SELECT u.id FROM auth.users u JOIN auth.user_roles ur ON ur.user_id=u.id JOIN auth.roles r ON r.id=ur.role_id
          WHERE u.id=$1 AND u.is_active AND r.name IN ('doctor','nurse','pharmacist','admin','super_admin')`,[data.witnessId]);
        if(!witness.rowCount) throw new ConflictError('Select an active clinical witness.');
      }
      if((await client.query('SELECT id FROM inpatient.administrations WHERE prescription_id=$1 AND scheduled_at=$2',[rx.id,data.scheduledAt])).rowCount) throw new ConflictError('This dose has already been recorded.');
      const { rows:[record] }=await client.query(`INSERT INTO inpatient.administrations(admission_id,prescription_id,scheduled_at,status,dose,route,reason,administered_by,witness_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,rx.id,data.scheduledAt,data.status,data.dose,data.route,data.reason??null,actor,data.witnessId??null]);
      await event(client,id,'medication_'+data.status,{prescriptionId:rx.id,scheduledAt:data.scheduledAt},actor);
      return record;
    });
  },
  async discharge(id:string,data:{summary:string;followUp:string;pendingResultsPlan:string},actor:string) {
    return withTransaction(async client=>{
      const current=await admission(client,id);
      const reconciliation=await client.query("SELECT id FROM inpatient.reconciliations WHERE admission_id=$1 AND phase='discharge'",[id]);
      if(!reconciliation.rowCount) throw new ConflictError('Complete discharge medication reconciliation first.');
      const pending=await client.query("SELECT id FROM emr.lab_orders WHERE encounter_id=$1 AND status NOT IN ('resulted','cancelled')",[current.encounter_id]);
      if(pending.rowCount && !data.pendingResultsPlan.trim()) throw new ConflictError('Document who will follow up pending lab results.');
      await client.query(`UPDATE inpatient.admissions SET status='discharged',discharged_at=NOW(),discharge_summary=$2,follow_up=$3 WHERE id=$1`,[id,data.summary,data.followUp]);
      await client.query(`INSERT INTO emr.clinical_notes(encounter_id,note_type,full_text,created_by) VALUES($1,'discharge',$2,$3)`,[current.encounter_id,`${data.summary}\nFollow-up: ${data.followUp}\nPending results: ${data.pendingResultsPlan}`,actor]);
      await client.query("UPDATE emr.encounters SET status='completed',completed_at=NOW(),updated_by=$2 WHERE id=$1",[current.encounter_id,actor]);
      await event(client,id,'discharged',data,actor);
      return {id,status:'discharged'};
    });
  },
};
