import { PortalRepository } from './portal.repository';
import { AppointmentsService } from '@/modules/appointments/appointments.service';
import { ConflictError, NotFoundError }    from '@/shared/errors/app-error';

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
    const existing = await this.repo.getPatientByUserId(userId);
    if (existing) {
      const samePatient =
        (data.patientId && existing.id === data.patientId) ||
        (data.mrn && existing.mrn === data.mrn);

      if (samePatient) return existing;
      throw new ConflictError('This portal account is already linked to a patient record.');
    }

    const patient = data.patientId
      ? await this.repo.getPatientById(data.patientId)
      : await this.repo.findPatientForPortalLink({
        mrn: data.mrn!,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
      });

    if (!patient) {
      throw new NotFoundError('Matching patient record');
    }

    if (patient.portal_user_id && patient.portal_user_id !== userId) {
      throw new ConflictError('This patient record is already linked to another portal account.');
    }

    await this.repo.linkPortalUser(patient.id, userId);
    return patient;
  }
}
