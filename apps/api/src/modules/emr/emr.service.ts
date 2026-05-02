import { EmrRepository } from './emr.repository';
import {
  CreateEncounterInput, VitalSignsInput,
  ClinicalNoteInput, DiagnosisInput,
  PrescriptionInput, LabOrderInput, ImagingOrderInput,
} from './emr.types';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors/app-error';
import { eventBus }  from '@/shared/events/event-bus';
import { EVENTS }    from '@/shared/events/event-types';
import { logger }    from '@/infrastructure/logger/logger';
import { getDb }     from '@/infrastructure/database/db.client';

export class EmrService {
  private repo = new EmrRepository();
  private db   = getDb();

  // ── Guard: check encounter exists and is not locked ───────
  private async getEncounterOrFail(id: string) {
    const encounter = await this.repo.findEncounterById(id);
    if (!encounter) throw new NotFoundError('Encounter', id);
    return encounter;
  }

  private async assertNotLocked(encounterId: string, allowAddendum = false) {
    const locked = await this.repo.isLocked(encounterId);
    if (locked && !allowAddendum) {
      throw new ForbiddenError(
        'This encounter is locked. Only addendums can be added after 24 hours.',
      );
    }
  }

  // ── Encounters ────────────────────────────────────────────
  async createEncounter(data: CreateEncounterInput, createdBy: string) {
    const encounter = await this.repo.createEncounter(data, createdBy);
    logger.info('Encounter created', { encounterId: encounter.id, patientId: data.patientId });
    eventBus.emit(EVENTS.ENCOUNTER_STARTED, { encounterId: encounter.id, patientId: data.patientId });
    return encounter;
  }

  async getEncounterById(id: string, requestedBy: string) {
    const encounter = await this.getEncounterOrFail(id);

    // HIPAA: log every view of a clinical record
    await this.db.query(
      `INSERT INTO audit.emr_access_logs (user_id, patient_id, encounter_id, access_type)
       VALUES ($1, $2, $3, 'view')`,
      [requestedBy, encounter.patient_id, id],
    );

    return encounter;
  }

  async getFullEncounter(id: string, requestedBy: string) {
    const full = await this.repo.getFullEncounter(id);
    if (!full) throw new NotFoundError('Encounter', id);

    await this.db.query(
      `INSERT INTO audit.emr_access_logs (user_id, patient_id, encounter_id, access_type)
       VALUES ($1, $2, $3, 'view')`,
      [requestedBy, full.encounter.patient_id, id],
    );

    return full;
  }

  async getEncountersByPatient(patientId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const rows   = await this.repo.findEncountersByPatient(patientId, limit, offset);
    return rows;
  }

  async getEncountersByDoctor(doctorId: string, date?: string) {
    return this.repo.findEncountersByDoctor(doctorId, date);
  }

  async completeEncounter(id: string) {
    const encounter = await this.getEncounterOrFail(id);
    if (encounter.status === 'completed') {
      throw new ValidationError([{ message: 'Encounter is already completed.' }]);
    }

    const updated = await this.repo.updateEncounterStatus(id, 'completed', {
      completed_at: new Date(),
    });

    logger.info('Encounter completed', { encounterId: id });
    eventBus.emit(EVENTS.ENCOUNTER_COMPLETED, {
      encounterId: id,
      patientId:   encounter.patient_id,
      doctorId:    encounter.doctor_id,
    });

    return updated;
  }

  // ── Vital signs ───────────────────────────────────────────
  async addVitalSigns(
    encounterId: string, data: VitalSignsInput, recordedBy: string,
  ) {
    const enc = await this.getEncounterOrFail(encounterId);
    await this.assertNotLocked(encounterId);
    const vitals = await this.repo.addVitalSigns(encounterId, enc.patient_id, data, recordedBy);
    logger.info('Vitals recorded', { encounterId, recordedBy });
    return vitals;
  }

  async getVitalSigns(encounterId: string) {
    await this.getEncounterOrFail(encounterId);
    return this.repo.getVitalSigns(encounterId);
  }

  // ── Clinical notes ────────────────────────────────────────
  async addClinicalNote(
    encounterId: string, data: ClinicalNoteInput, createdBy: string,
  ) {
    await this.getEncounterOrFail(encounterId);

    // Addendums bypass the lock — everything else is blocked when locked
    const isAddendum = data.noteType === 'addendum';
    await this.assertNotLocked(encounterId, isAddendum);

    if (isAddendum && !data.addendumToId) {
      throw new ValidationError([{
        message: 'Addendum must reference the original note via addendumToId.',
      }]);
    }

    const note = await this.repo.addClinicalNote(encounterId, data, createdBy);
    logger.info('Clinical note added', { encounterId, noteType: data.noteType });
    return note;
  }

  async getClinicalNotes(encounterId: string) {
    await this.getEncounterOrFail(encounterId);
    return this.repo.getClinicalNotes(encounterId);
  }

  // ── Diagnoses ─────────────────────────────────────────────
  async addDiagnosis(
    encounterId: string, data: DiagnosisInput, createdBy: string,
  ) {
    const enc = await this.getEncounterOrFail(encounterId);
    await this.assertNotLocked(encounterId);
    const diagnosis = await this.repo.addDiagnosis(encounterId, enc.patient_id, data, createdBy);
    logger.info('Diagnosis added', { encounterId, icd10Code: data.icd10Code });
    return diagnosis;
  }

  async removeDiagnosis(encounterId: string, diagnosisId: string) {
    await this.assertNotLocked(encounterId);
    const removed = await this.repo.removeDiagnosis(diagnosisId, encounterId);
    if (!removed) throw new NotFoundError('Diagnosis', diagnosisId);
  }

  async getDiagnoses(encounterId: string) {
    await this.getEncounterOrFail(encounterId);
    return this.repo.getDiagnoses(encounterId);
  }

  // ── Prescriptions ─────────────────────────────────────────
  async addPrescription(
    encounterId: string, data: PrescriptionInput, prescribedBy: string,
  ) {
    const enc = await this.getEncounterOrFail(encounterId);
    await this.assertNotLocked(encounterId);
    const rx = await this.repo.addPrescription(encounterId, enc.patient_id, data, prescribedBy);

    logger.info('Prescription created', { encounterId, drugName: data.drugName });
    eventBus.emit(EVENTS.PRESCRIPTION_CREATED, {
      encounterId,
      patientId:  enc.patient_id,
      drugName:   data.drugName,
      prescriptionId: rx.id,
    });

    return rx;
  }

  async cancelPrescription(encounterId: string, prescriptionId: string) {
    await this.assertNotLocked(encounterId);
    const cancelled = await this.repo.cancelPrescription(prescriptionId, encounterId);
    if (!cancelled) throw new NotFoundError('Prescription', prescriptionId);
  }

  async getPrescriptions(encounterId: string) {
    await this.getEncounterOrFail(encounterId);
    return this.repo.getPrescriptions(encounterId);
  }

  // ── Lab orders ────────────────────────────────────────────
  async addLabOrder(
    encounterId: string, data: LabOrderInput, orderedBy: string,
  ) {
    const enc = await this.getEncounterOrFail(encounterId);
    await this.assertNotLocked(encounterId);
    const order = await this.repo.addLabOrder(encounterId, enc.patient_id, data, orderedBy);

    logger.info('Lab order created', { encounterId, testName: data.testName, urgency: data.urgency });
    eventBus.emit(EVENTS.LAB_ORDER_CREATED, {
      encounterId,
      patientId: enc.patient_id,
      orderId:   order.id,
      urgency:   data.urgency,
    });

    return order;
  }

  async getLabOrders(encounterId: string) {
    await this.getEncounterOrFail(encounterId);
    return this.repo.getLabOrders(encounterId);
  }

  // ── Imaging orders ────────────────────────────────────────
  async addImagingOrder(
    encounterId: string, data: ImagingOrderInput, orderedBy: string,
  ) {
    const enc = await this.getEncounterOrFail(encounterId);
    await this.assertNotLocked(encounterId);
    const order = await this.repo.addImagingOrder(encounterId, enc.patient_id, data, orderedBy);
    logger.info('Imaging order created', { encounterId, modality: data.modality });
    return order;
  }

  async getImagingOrders(encounterId: string) {
    await this.getEncounterOrFail(encounterId);
    return this.repo.getImagingOrders(encounterId);
  }

  // ── Medical history ───────────────────────────────────────
  async getMedicalHistory(patientId: string, requestedBy: string) {
    await this.db.query(
      `INSERT INTO audit.emr_access_logs (user_id, patient_id, access_type)
       VALUES ($1, $2, 'view')`,
      [requestedBy, patientId],
    );
    return this.repo.getPatientMedicalHistory(patientId);
  }
}
