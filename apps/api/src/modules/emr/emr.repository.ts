import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import {
  CreateEncounterInput, VitalSignsInput,
  ClinicalNoteInput, DiagnosisInput,
  PrescriptionInput, LabOrderInput, ImagingOrderInput,
  EncounterRow,
} from './emr.types';

export class EmrRepository {
  private db: Pool = getDb();

  // ── Encounters ────────────────────────────────────────────
  async findEncounterById(id: string): Promise<EncounterRow | null> {
    const { rows } = await this.db.query<EncounterRow>(
      `SELECT e.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              u.full_name AS doctor_name
       FROM emr.encounters e
       JOIN patients.patients p ON p.id = e.patient_id
       JOIN doctors.doctors   d ON d.id = e.doctor_id
       JOIN auth.users         u ON u.id = d.user_id
       WHERE e.id = $1 AND e.is_deleted = FALSE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findEncountersByPatient(
    patientId: string, limit = 20, offset = 0,
  ) {
    const { rows } = await this.db.query(
      `SELECT e.*,
              u.full_name AS doctor_name,
              COUNT(d.id) AS diagnosis_count,
              COUNT(pr.id) AS prescription_count
       FROM emr.encounters e
       JOIN doctors.doctors  doc ON doc.id = e.doctor_id
       JOIN auth.users         u ON u.id = doc.user_id
       LEFT JOIN emr.diagnoses   d  ON d.encounter_id  = e.id
       LEFT JOIN emr.prescriptions pr ON pr.encounter_id = e.id
       WHERE e.patient_id = $1 AND e.is_deleted = FALSE
       GROUP BY e.id, u.full_name
       ORDER BY e.started_at DESC
       LIMIT $2 OFFSET $3`,
      [patientId, limit, offset],
    );
    return rows;
  }

  async findEncountersByDoctor(doctorId: string, date?: string) {
    const params: unknown[] = [doctorId];
    let where = 'e.doctor_id = $1 AND e.is_deleted = FALSE';
    if (date) { params.push(date); where += ` AND DATE(e.started_at) = $2::DATE`; }
    const { rows } = await this.db.query(
      `SELECT e.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn
       FROM emr.encounters e
       JOIN patients.patients p ON p.id = e.patient_id
       WHERE ${where}
       ORDER BY e.started_at DESC`,
      params,
    );
    return rows;
  }

  async createEncounter(
    data: CreateEncounterInput, createdBy: string,
  ): Promise<EncounterRow> {
    const { rows } = await this.db.query<EncounterRow>(
      `INSERT INTO emr.encounters
         (patient_id, doctor_id, appointment_id, encounter_type,
          chief_complaint, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        data.patientId, data.doctorId,
        data.appointmentId ?? null,
        data.encounterType,
        data.chiefComplaint ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  async updateEncounterStatus(
    id: string, status: string,
    extra: Record<string, unknown> = {},
  ): Promise<EncounterRow | null> {
    const sets  = ['status = $2', 'updated_at = NOW()'];
    const vals: unknown[] = [id, status];
    let i = 3;
    for (const [k, v] of Object.entries(extra)) {
      sets.push(`${k} = $${i++}`); vals.push(v);
    }
    const { rows } = await this.db.query<EncounterRow>(
      `UPDATE emr.encounters SET ${sets.join(', ')}
       WHERE id = $1 AND is_deleted = FALSE RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  async lockEncounter(id: string): Promise<void> {
    await this.db.query(
      `UPDATE emr.encounters SET locked_at = NOW()
       WHERE id = $1 AND locked_at IS NULL`,
      [id],
    );
  }

  async isLocked(id: string): Promise<boolean> {
    const { rows } = await this.db.query<{ locked_at: Date | null }>(
      `SELECT locked_at FROM emr.encounters WHERE id = $1`,
      [id],
    );
    return rows[0]?.locked_at != null;
  }

  // ── Vital signs ───────────────────────────────────────────
  async getVitalSigns(encounterId: string) {
    const { rows } = await this.db.query(
      `SELECT vs.*, u.full_name AS recorded_by_name
       FROM emr.vital_signs vs
       JOIN auth.users u ON u.id = vs.recorded_by
       WHERE vs.encounter_id = $1
       ORDER BY vs.recorded_at DESC`,
      [encounterId],
    );
    return rows;
  }

  async addVitalSigns(
    encounterId: string, patientId: string,
    data: VitalSignsInput, recordedBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO emr.vital_signs
         (encounter_id, patient_id, recorded_by, recorded_at,
          temperature_c, bp_systolic, bp_diastolic, pulse_bpm,
          respiratory_rate, o2_saturation, weight_kg, height_cm,
          blood_glucose, extra_vitals, notes)
       VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        encounterId, patientId, recordedBy,
        data.temperatureC ?? null,
        data.bpSystolic   ?? null,
        data.bpDiastolic  ?? null,
        data.pulseBpm     ?? null,
        data.respiratoryRate ?? null,
        data.o2Saturation ?? null,
        data.weightKg     ?? null,
        data.heightCm     ?? null,
        data.bloodGlucose ?? null,
        data.extraVitals ? JSON.stringify(data.extraVitals) : null,
        data.notes        ?? null,
      ],
    );
    return rows[0];
  }

  // ── Clinical notes ────────────────────────────────────────
  async getClinicalNotes(encounterId: string) {
    const { rows } = await this.db.query(
      `SELECT cn.*, u.full_name AS author_name
       FROM emr.clinical_notes cn
       JOIN auth.users u ON u.id = cn.created_by
       WHERE cn.encounter_id = $1
       ORDER BY cn.created_at ASC`,
      [encounterId],
    );
    return rows;
  }

  async addClinicalNote(
    encounterId: string, data: ClinicalNoteInput, createdBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO emr.clinical_notes
         (encounter_id, note_type, subjective, objective, assessment,
          plan, full_text, is_addendum, addendum_to_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        encounterId,
        data.noteType,
        data.subjective  ?? null,
        data.objective   ?? null,
        data.assessment  ?? null,
        data.plan        ?? null,
        data.fullText    ?? null,
        data.noteType === 'addendum',
        data.addendumToId ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  // ── Diagnoses ─────────────────────────────────────────────
  async getDiagnoses(encounterId: string) {
    const { rows } = await this.db.query(
      `SELECT d.*, u.full_name AS recorded_by_name
       FROM emr.diagnoses d
       JOIN auth.users u ON u.id = d.created_by
       WHERE d.encounter_id = $1
       ORDER BY d.diagnosis_type ASC, d.created_at ASC`,
      [encounterId],
    );
    return rows;
  }

  async addDiagnosis(
    encounterId: string, patientId: string,
    data: DiagnosisInput, createdBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO emr.diagnoses
         (encounter_id, patient_id, icd10_code, icd10_name,
          icd10_name_fa, diagnosis_type, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        encounterId, patientId,
        data.icd10Code, data.icd10Name,
        data.icd10NameFa  ?? null,
        data.diagnosisType,
        data.notes        ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  async removeDiagnosis(diagnosisId: string, encounterId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `DELETE FROM emr.diagnoses WHERE id = $1 AND encounter_id = $2`,
      [diagnosisId, encounterId],
    );
    return (rowCount ?? 0) > 0;
  }

  // ── Prescriptions ─────────────────────────────────────────
  async getPrescriptions(encounterId: string) {
    const { rows } = await this.db.query(
      `SELECT pr.*, u.full_name AS prescribed_by_name
       FROM emr.prescriptions pr
       JOIN auth.users u ON u.id = pr.prescribed_by
       WHERE pr.encounter_id = $1
       ORDER BY pr.created_at ASC`,
      [encounterId],
    );
    return rows;
  }

  async addPrescription(
    encounterId: string, patientId: string,
    data: PrescriptionInput, prescribedBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO emr.prescriptions
         (encounter_id, patient_id, prescribed_by, drug_name,
          generic_name, dosage, frequency, route, duration_days,
          quantity, unit, instructions, is_controlled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        encounterId, patientId, prescribedBy,
        data.drugName,
        data.genericName  ?? null,
        data.dosage, data.frequency, data.route,
        data.durationDays ?? null,
        data.quantity, data.unit,
        data.instructions ?? null,
        data.isControlled ?? false,
      ],
    );
    return rows[0];
  }

  async cancelPrescription(prescriptionId: string, encounterId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE emr.prescriptions SET status = 'cancelled'
       WHERE id = $1 AND encounter_id = $2 AND status = 'pending'`,
      [prescriptionId, encounterId],
    );
    return (rowCount ?? 0) > 0;
  }

  // ── Lab orders ────────────────────────────────────────────
  async getLabOrders(encounterId: string) {
    const { rows } = await this.db.query(
      `SELECT lo.*, u.full_name AS ordered_by_name
       FROM emr.lab_orders lo
       JOIN auth.users u ON u.id = lo.ordered_by
       WHERE lo.encounter_id = $1
       ORDER BY lo.urgency ASC, lo.created_at ASC`,
      [encounterId],
    );
    return rows;
  }

  async addLabOrder(
    encounterId: string, patientId: string,
    data: LabOrderInput, orderedBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO emr.lab_orders
         (encounter_id, patient_id, ordered_by,
          test_name, test_code, urgency, clinical_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        encounterId, patientId, orderedBy,
        data.testName, data.testCode ?? null,
        data.urgency,
        data.clinicalNotes ?? null,
      ],
    );
    return rows[0];
  }

  // ── Imaging orders ────────────────────────────────────────
  async getImagingOrders(encounterId: string) {
    const { rows } = await this.db.query(
      `SELECT io.*, u.full_name AS ordered_by_name
       FROM emr.imaging_orders io
       JOIN auth.users u ON u.id = io.ordered_by
       WHERE io.encounter_id = $1
       ORDER BY io.urgency ASC, io.created_at ASC`,
      [encounterId],
    );
    return rows;
  }

  async addImagingOrder(
    encounterId: string, patientId: string,
    data: ImagingOrderInput, orderedBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO emr.imaging_orders
         (encounter_id, patient_id, ordered_by,
          modality, body_part, urgency, clinical_indication)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        encounterId, patientId, orderedBy,
        data.modality, data.bodyPart, data.urgency,
        data.clinicalIndication ?? null,
      ],
    );
    return rows[0];
  }

  // ── Full encounter summary ────────────────────────────────
  async getFullEncounter(id: string) {
    const encounter = await this.findEncounterById(id);
    if (!encounter) return null;

    const [vitals, notes, diagnoses, prescriptions, labOrders, imagingOrders] =
      await Promise.all([
        this.getVitalSigns(id),
        this.getClinicalNotes(id),
        this.getDiagnoses(id),
        this.getPrescriptions(id),
        this.getLabOrders(id),
        this.getImagingOrders(id),
      ]);

    return { encounter, vitals, notes, diagnoses, prescriptions, labOrders, imagingOrders };
  }

  // ── Medical history ───────────────────────────────────────
  async getPatientMedicalHistory(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT
         e.id, e.started_at, e.completed_at, e.encounter_type, e.status,
         e.chief_complaint, e.locked_at,
         u.full_name AS doctor_name,
         ARRAY(
           SELECT icd10_name FROM emr.diagnoses
           WHERE encounter_id = e.id AND diagnosis_type = 'primary' LIMIT 3
         ) AS primary_diagnoses,
         ARRAY(
           SELECT drug_name FROM emr.prescriptions
           WHERE encounter_id = e.id AND status != 'cancelled' LIMIT 5
         ) AS medications,
         (SELECT COUNT(*) FROM emr.lab_orders WHERE encounter_id = e.id)::INT AS lab_count,
         (SELECT COUNT(*) FROM emr.imaging_orders WHERE encounter_id = e.id)::INT AS imaging_count
       FROM emr.encounters e
       JOIN doctors.doctors  d ON d.id = e.doctor_id
       JOIN auth.users        u ON u.id = d.user_id
       WHERE e.patient_id = $1
         AND e.is_deleted = FALSE
         AND e.status = 'completed'
       ORDER BY e.started_at DESC
       LIMIT 50`,
      [patientId],
    );
    return rows;
  }
}
