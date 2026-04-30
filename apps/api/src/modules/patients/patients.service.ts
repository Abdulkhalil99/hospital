import { PatientsRepository } from './patients.repository';
import { OtpService }         from './otp.service';
import {
  CreatePatientInput, UpdatePatientInput,
  AllergyInput, FamilyMemberInput, SearchParams,
} from './patients.types';
import { NotFoundError, ConflictError, ForbiddenError } from '@/shared/errors/app-error';
import { eventBus }  from '@/shared/events/event-bus';
import { EVENTS }    from '@/shared/events/event-types';
import { logger }    from '@/infrastructure/logger/logger';
import { getDb }     from '@/infrastructure/database/db.client';

export class PatientsService {
  private repo   = new PatientsRepository();
  private otp    = new OtpService();
  private db     = getDb();

  // ── Search ───────────────────────────────────────────────
  async search(params: SearchParams) {
    const limit  = Math.min(100, Math.max(1, params.limit  ?? 20));
    const page   = Math.max(1, params.page ?? 1);
    const offset = (page - 1) * limit;
    const { rows, total } = await this.repo.search(
      params.q ?? '', limit, offset, params.gender, params.active,
    );
    return {
      data:       rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Get by ID ────────────────────────────────────────────
  async getById(id: string) {
    const patient = await this.repo.findById(id);
    if (!patient) throw new NotFoundError('Patient', id);
    return patient;
  }

  async getByMrn(mrn: string) {
    const patient = await this.repo.findByMrn(mrn);
    if (!patient) throw new NotFoundError('Patient', mrn);
    return patient;
  }

  // ── Register (step 1) — create record + send OTP ─────────
  async register(
    data:      CreatePatientInput,
    createdBy: string,
  ): Promise<{ patient: Awaited<ReturnType<PatientsRepository['findById']>>; otpRequired: boolean; otpId?: string }> {

    // 1. Check for duplicates
    if (data.nationalId) {
      const byNid = await this.repo.findByNationalId(data.nationalId);
      if (byNid) {
        throw new ConflictError(
          `Patient with national ID already registered. MRN: ${byNid.mrn}`,
        );
      }
    }

    const byPhone = await this.repo.findByPhone(data.phone);
    if (byPhone) {
      throw new ConflictError(
        `A patient with phone ${data.phone} already exists. MRN: ${byPhone.mrn}`,
      );
    }

    // Check name+DOB duplicates (warn, don't block)
    const nameDups = await this.repo.findPossibleDuplicates(
      data.firstName, data.lastName, data.dateOfBirth,
    );
    if (nameDups.length > 0) {
      logger.warn('Possible duplicate patient', {
        name:      `${data.firstName} ${data.lastName}`,
        dob:       data.dateOfBirth,
        existingMrns: nameDups.map(p => p.mrn),
      });
    }

    // 2. Generate MRN
    const { rows } = await this.db.query<{ mrn: string }>(
      `SELECT settings.next_sequence('mrn') AS mrn`,
    );
    const mrn = rows[0].mrn;

    // 3. Create the patient record
    const patient = await this.repo.create(data, mrn, createdBy);

    logger.info('Patient registered', { patientId: patient!.id, mrn });
    eventBus.emit(EVENTS.PATIENT_REGISTERED, { patientId: patient!.id, mrn: patient!.mrn });

    // 4. Send OTP unless emergency walk-in (skipOtp = true)
    if (!data.skipOtp) {
      const targetType = data.email ? 'email' : 'phone';
      const target     = targetType === 'email' ? data.email! : data.phone;
      const { otpId }  = await this.otp.send(target, targetType, 'registration', patient!.id);
      return { patient, otpRequired: true, otpId };
    }

    return { patient, otpRequired: false };
  }

  // ── Verify OTP (step 2) ───────────────────────────────────
  async verifyRegistrationOtp(
    patientId: string, target: string, code: string,
  ): Promise<void> {
    await this.otp.verify(target, code, 'registration');
    logger.info('Patient OTP verified', { patientId });
  }

  // ── Resend OTP ────────────────────────────────────────────
  async resendOtp(patientId: string, target: string, type: 'phone' | 'email') {
    const patient = await this.getById(patientId);
    return this.otp.send(target, type, 'registration', patient.id);
  }

  // ── Update profile ────────────────────────────────────────
  async update(
    id:        string,
    data:      UpdatePatientInput,
    updatedBy: string,
  ) {
    await this.getById(id);

    // Check phone uniqueness if changing
    if (data.phone) {
      const existing = await this.repo.findByPhone(data.phone);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Phone ${data.phone} is already registered to MRN ${existing.mrn}`);
      }
    }

    const updated = await this.repo.update(id, data, updatedBy);
    if (!updated) throw new NotFoundError('Patient', id);

    eventBus.emit(EVENTS.PATIENT_UPDATED, { patientId: id });
    return updated;
  }

  // ── Soft delete ───────────────────────────────────────────
  async delete(id: string, deletedBy: string): Promise<void> {
    await this.getById(id);
    const deleted = await this.repo.softDelete(id, deletedBy);
    if (!deleted) throw new NotFoundError('Patient', id);
    logger.info('Patient deactivated', { patientId: id });
  }

  // ── Allergies ─────────────────────────────────────────────
  async getAllergies(patientId: string) {
    await this.getById(patientId);
    return this.repo.getAllergies(patientId);
  }

  async addAllergy(patientId: string, data: AllergyInput, recordedBy: string) {
    await this.getById(patientId);
    const allergy = await this.repo.addAllergy(patientId, data, recordedBy);
    logger.info('Allergy added', { patientId, allergen: data.allergen, severity: data.severity });
    return allergy;
  }

  async removeAllergy(patientId: string, allergyId: string): Promise<void> {
    const removed = await this.repo.removeAllergy(allergyId, patientId);
    if (!removed) throw new NotFoundError('Allergy', allergyId);
  }

  // ── Family members ────────────────────────────────────────
  async getFamilyMembers(patientId: string) {
    await this.getById(patientId);
    return this.repo.getFamilyMembers(patientId);
  }

  async addFamilyMember(
    primaryId: string,
    data:      FamilyMemberInput,
    linkedBy:  string,
  ) {
    await this.getById(primaryId);
    await this.getById(data.memberPatientId);   // ensure member exists

    if (primaryId === data.memberPatientId) {
      throw new ConflictError('A patient cannot be linked to themselves.');
    }

    const member = await this.repo.addFamilyMember(primaryId, data, linkedBy);
    logger.info('Family member linked', { primaryId, memberId: data.memberPatientId, relationship: data.relationship });
    return member;
  }

  async removeFamilyMember(
    primaryId: string, memberId: string, revokedBy: string,
  ): Promise<void> {
    const removed = await this.repo.removeFamilyMember(primaryId, memberId, revokedBy);
    if (!removed) throw new NotFoundError('Family link');
  }

  // ── Medical history ───────────────────────────────────────
  async getMedicalHistory(patientId: string, requestedBy: string) {
    await this.getById(patientId);

    // Log access for HIPAA compliance
    await this.db.query(
      `INSERT INTO audit.emr_access_logs (user_id, patient_id, access_type)
       VALUES ($1, $2, 'view')`,
      [requestedBy, patientId],
    );

    return this.repo.getMedicalHistory(patientId);
  }
}
