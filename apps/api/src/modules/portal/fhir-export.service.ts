import { getDb } from '@/infrastructure/database/db.client';
import { NotFoundError } from '@/shared/errors/app-error';
import { PortalRepository } from './portal.repository';
import { makePatientBundle } from './fhir-export';

/** Downloadable summary. Each clinical category is limited to its 100 newest records. */
export async function exportMyFhirSummary(userId: string) {
  const patient = await new PortalRepository().getPatientByUserId(userId);
  if (!patient) throw new NotFoundError('Patient profile linked to this account');
  const db = getDb();
  const [allergies, diagnoses, prescriptions, vitals, labResults] = await Promise.all([
    db.query('SELECT id,allergen,reaction,severity,recorded_at FROM patients.allergies WHERE patient_id=$1 AND is_active ORDER BY recorded_at DESC LIMIT 100', [patient.id]),
    db.query(`SELECT d.id,d.icd10_code,d.icd10_name,d.created_at FROM emr.diagnoses d
      JOIN emr.encounters e ON e.id=d.encounter_id AND NOT e.is_deleted AND e.status<>'voided'
      WHERE d.patient_id=$1 ORDER BY d.created_at DESC LIMIT 100`, [patient.id]),
    db.query(`SELECT p.id,p.drug_name,p.generic_name,p.dosage,p.route,p.frequency,p.instructions,p.status,p.created_at
      FROM emr.prescriptions p JOIN emr.encounters e ON e.id=p.encounter_id AND NOT e.is_deleted AND e.status<>'voided'
      WHERE p.patient_id=$1 ORDER BY p.created_at DESC LIMIT 100`, [patient.id]),
    db.query(`SELECT v.id,v.recorded_at,v.temperature_c,v.pulse_bpm,v.respiratory_rate,v.o2_saturation,
      v.weight_kg,v.height_cm,v.bp_systolic,v.bp_diastolic
      FROM emr.vital_signs v JOIN emr.encounters e ON e.id=v.encounter_id AND NOT e.is_deleted AND e.status<>'voided'
      WHERE v.patient_id=$1 ORDER BY v.recorded_at DESC LIMIT 100`, [patient.id]),
    db.query(`SELECT r.id,r.component_name,r.result_value,r.unit,r.validated_at,o.test_name
      FROM laboratory.lab_results r JOIN emr.lab_orders o ON o.id=r.order_id
      JOIN emr.encounters e ON e.id=o.encounter_id AND NOT e.is_deleted AND e.status<>'voided'
      WHERE r.patient_id=$1 AND r.validated_at IS NOT NULL AND r.released_at IS NOT NULL
      ORDER BY r.released_at DESC LIMIT 100`, [patient.id]),
  ]);
  await db.query("INSERT INTO audit.emr_access_logs(user_id,patient_id,access_type) VALUES($1,$2,'export')", [userId, patient.id]);
  return { bundle: makePatientBundle({ patient, allergies: allergies.rows, diagnoses: diagnoses.rows,
    prescriptions: prescriptions.rows, vitals: vitals.rows, labResults: labResults.rows }), mrn: patient.mrn };
}
