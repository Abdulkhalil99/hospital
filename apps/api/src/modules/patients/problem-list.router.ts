import { Router } from 'express';
import { z } from 'zod';
import { getDb, withTransaction } from '@/infrastructure/database/db.client';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { validate } from '@/shared/middleware/validate';
import { asyncHandler } from '@/shared/utils/async-handler';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';

const uuid = z.string().uuid();
const createSchema = z.object({
  icd10Code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9.]+$/),
  display: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(4000).optional(),
}).strict();
const updateSchema = z.object({
  status: z.enum(['active', 'resolved', 'entered_in_error']),
  notes: z.string().trim().max(4000).optional(),
}).strict();

export const problemListRouter = Router({ mergeParams: true });
problemListRouter.use(authenticate);

problemListRouter.get('/', authorize('emr:read'), asyncHandler(async (req, res) => {
  const patientId = uuid.parse(req.params.id);
  const db = getDb();
  const patient = await db.query('SELECT id FROM patients.patients WHERE id=$1 AND is_active AND NOT is_deleted', [patientId]);
  if (!patient.rowCount) throw new NotFoundError('Patient', patientId);
  const { rows } = await db.query(`SELECT id,patient_id,icd10_code,display,status,notes,recorded_at,resolved_at,updated_at
    FROM patients.problem_list WHERE patient_id=$1 ORDER BY (status='active') DESC, recorded_at DESC`, [patientId]);
  await db.query("INSERT INTO audit.emr_access_logs(user_id,patient_id,access_type) VALUES($1,$2,'view')", [req.user!.id, patientId]);
  res.json({ success: true, data: rows });
}));

problemListRouter.post('/', authorize('emr:write'), validate(createSchema), asyncHandler(async (req, res) => {
  const patientId = uuid.parse(req.params.id);
  const record = await withTransaction(async client => {
    const patient = await client.query('SELECT id FROM patients.patients WHERE id=$1 AND is_active AND NOT is_deleted FOR UPDATE', [patientId]);
    if (!patient.rowCount) throw new NotFoundError('Patient', patientId);
    const existing = await client.query('SELECT id FROM patients.problem_list WHERE patient_id=$1 AND upper(icd10_code)=upper($2)', [patientId, req.body.icd10Code]);
    if (existing.rowCount) throw new ConflictError('This condition is already on the problem list. Update its status instead.');
    const { rows } = await client.query(`INSERT INTO patients.problem_list(patient_id,icd10_code,display,notes,recorded_by)
      VALUES($1,upper($2),$3,$4,$5) RETURNING *`, [patientId, req.body.icd10Code, req.body.display, req.body.notes ?? null, req.user!.id]);
    return rows[0];
  });
  res.status(201).json({ success: true, data: record });
}));

problemListRouter.patch('/:problemId', authorize('emr:write'), validate(updateSchema), asyncHandler(async (req, res) => {
  const patientId = uuid.parse(req.params.id), problemId = uuid.parse(req.params.problemId);
  const { rows } = await getDb().query(`UPDATE patients.problem_list SET status=$3::text,
    notes=COALESCE($4,notes),resolved_at=CASE WHEN $3::text='resolved' THEN NOW() ELSE NULL END,
    updated_at=NOW(),updated_by=$5 WHERE id=$1 AND patient_id=$2
    RETURNING *`, [problemId, patientId, req.body.status, req.body.notes ?? null, req.user!.id]);
  if (!rows[0]) throw new NotFoundError('Problem', problemId);
  res.json({ success: true, data: rows[0] });
}));
