import { PortalRepository } from './portal.repository';
import { AppointmentsService } from '@/modules/appointments/appointments.service';
import { ConflictError, NotFoundError, UnauthorizedError } from '@/shared/errors/app-error';
import { verifiedLinkPatientSchema } from './portal.validation';
import { z } from 'zod';

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

  async linkPatient(userId: string, data: z.infer<typeof verifiedLinkPatientSchema>) {
    const result = await this.repo.verifyAndLinkPortalUser(userId, data);
    if (result.status === 'invalid') throw new UnauthorizedError('Invalid or expired verification code.');
    if (result.status === 'conflict') throw new ConflictError('The patient record or portal account is already linked. Please refresh and try again.');
    return result.patient;
  }
}
