import { PortalRepository } from './portal.repository';
import { NotFoundError }    from '@/shared/errors/app-error';

export class PortalService {
  private repo = new PortalRepository();

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

  async linkPatient(userId: string, patientId: string) {
    await this.repo.linkPortalUser(patientId, userId);
  }
}
