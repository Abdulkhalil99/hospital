import { PortalRepository } from './portal.repository';
import { AppointmentsService } from '@/modules/appointments/appointments.service';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { linkPatientSchema } from './portal.validation';

export class PortalService {
  private repo = new PortalRepository();
  private appointments = new AppointmentsService();

  private async getPatientOrFail(userId: string) {
    const patient = await this.repo.getPatientByUserId(userId);
    if (!patient) throw new NotFoundError('Patient profile linked to this account');
    return patient;
  }

  async getMyProfile(userId: string) {
    const patient = await this.getPatientOrFail(userId);
    return this.repo.getMyProfile(patient.id);
  }

  async getMedicalSummary(userId: string) {
    const patient = await this.getPatientOrFail(userId);
    return this.repo.getMedicalSummary(patient.id);
  }

  async getMyAppointments(userId: string, upcoming = false) {
    const patient = await this.getPatientOrFail(userId);
    return this.repo.getMyAppointments(patient.id, upcoming);
  }

  async cancelMyAppointment(userId: string, appointmentId: string, reason: string) {
    const patient = await this.getPatientOrFail(userId);
    const appointment = await this.appointments.getById(appointmentId);

    if (appointment.patient_id !== patient.id) {
      throw new NotFoundError('Appointment', appointmentId);
    }

    return this.appointments.cancel(appointmentId, reason, userId);
  }

  async getMyLabResults(userId: string) {
    const patient = await this.getPatientOrFail(userId);
    return this.repo.getMyLabResults(patient.id);
  }

  async getMyPrescriptions(userId: string) {
    const patient = await this.getPatientOrFail(userId);
    return this.repo.getMyPrescriptions(patient.id);
  }

  async getMyInvoices(userId: string) {
    const patient = await this.getPatientOrFail(userId);
    return this.repo.getMyInvoices(patient.id);
  }

  async getMyInvoiceDetail(userId: string, invoiceId: string) {
    const patient = await this.getPatientOrFail(userId);
    const detail  = await this.repo.getMyInvoiceDetail(invoiceId, patient.id);
    if (!detail) throw new NotFoundError('Invoice', invoiceId);
    return detail;
  }

  async getMyAllergies(userId: string) {
    const patient = await this.getPatientOrFail(userId);
    return this.repo.getMyAllergies(patient.id);
  }

  async linkPatient(userId: string, data: {
    patientId?: string;
    mrn?: string;
    phone?: string;
    dateOfBirth?: string;
  }) {
    const parsed = linkPatientSchema.safeParse(data);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(({ message, path }) => ({ message, path })));
    }
    const identity = parsed.data;
    const existing = await this.repo.getPatientByUserId(userId);
    if (existing) {
      const samePatient =
        existing.mrn === identity.mrn &&
        (!identity.patientId || existing.id === identity.patientId);

      if (samePatient) return existing;
      throw new ConflictError('This portal account is already linked to a patient record.');
    }

    const patient = await this.repo.findPatientForPortalLink(identity);

    if (!patient) {
      throw new NotFoundError('Matching patient record');
    }

    if (patient.portal_user_id && patient.portal_user_id !== userId) {
      throw new ConflictError('This patient record is already linked to another portal account.');
    }

    const linkedPatient = await this.repo.linkPortalUser(patient.id, userId);
    if (!linkedPatient) {
      throw new ConflictError('The patient record or portal account is already linked. Please refresh and try again.');
    }
    return linkedPatient;
  }
}
