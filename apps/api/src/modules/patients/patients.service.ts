// ── ALL business logic here. No req/res. No SQL. ─────────────────────

import { PatientsRepository }  from './patients.repository';
import { CreatePatientInput, PatientRow } from './patients.types';
import { NotFoundError, ConflictError }   from '@/shared/errors/app-error';
import { eventBus }  from '@/shared/events/event-bus';
import { EVENTS }    from '@/shared/events/event-types';
import { logger }    from '@/infrastructure/logger/logger';

function generateMrn(sequence: number): string {
  return `MC-${String(sequence).padStart(6, '0')}`;
}

export class PatientsService {
  private repo = new PatientsRepository();

  async getById(id: string): Promise<PatientRow> {
    const patient = await this.repo.findById(id);
    if (!patient) throw new NotFoundError('Patient', id);
    return patient;
  }

  async getByMrn(mrn: string): Promise<PatientRow> {
    const patient = await this.repo.findByMrn(mrn);
    if (!patient) throw new NotFoundError('Patient', mrn);
    return patient;
  }

  async search(
    query: string,
    page:  number,
    limit: number,
  ) {
    const safeLimit  = Math.min(100, Math.max(1, limit));
    const safePage   = Math.max(1, page);
    const offset     = (safePage - 1) * safeLimit;

    const { rows, total } = await this.repo.search(query, safeLimit, offset);

    return {
      data: rows,
      pagination: {
        page:       safePage,
        limit:      safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async create(data: CreatePatientInput, createdBy: string): Promise<PatientRow> {

    // Business rule 1: national ID must be globally unique
    if (data.nationalId) {
      const existing = await this.repo.findByNationalId(data.nationalId);
      if (existing) {
        throw new ConflictError(
          `A patient with national ID '${data.nationalId}' already exists ` +
          `(MRN: ${existing.mrn})`,
        );
      }
    }

    // Business rule 2: generate MRN from sequence
    const sequence = await this.repo.countAll();
    const mrn      = generateMrn(sequence + 1);

    const patient = await this.repo.create(data, mrn, createdBy);

    logger.info('Patient registered', { patientId: patient.id, mrn: patient.mrn });

    // Notify other modules — they listen without knowing about this module
    eventBus.emit(EVENTS.PATIENT_REGISTERED, {
      patientId: patient.id,
      mrn:       patient.mrn,
    });

    return patient;
  }

  async update(
    id:        string,
    data:      Partial<CreatePatientInput>,
    updatedBy: string,
  ): Promise<PatientRow> {
    await this.getById(id);   // throws NotFoundError if missing

    const updated = await this.repo.update(id, data, updatedBy);
    if (!updated) throw new NotFoundError('Patient', id);

    eventBus.emit(EVENTS.PATIENT_UPDATED, { patientId: id });
    return updated;
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    await this.getById(id);   // throws NotFoundError if missing
    const deleted = await this.repo.softDelete(id, deletedBy);
    if (!deleted) throw new NotFoundError('Patient', id);
    logger.info('Patient deactivated', { patientId: id, deletedBy });
  }
}