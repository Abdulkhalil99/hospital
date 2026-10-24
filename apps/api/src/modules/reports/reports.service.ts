import { ReportsRepository } from './reports.repository';

export class ReportsService {
  private repo = new ReportsRepository();

  private boundedInt(value: number, fallback: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(value)));
  }

  async getKpiSnapshot()         { return this.repo.getKpiSnapshot(); }
  async getRevenueByDay(days=30) { return this.repo.getRevenueByDay(this.boundedInt(days, 30, 1, 365)); }
  async getPatientsByDay(days=30){ return this.repo.getPatientsByDay(this.boundedInt(days, 30, 1, 365)); }
  async getAppointmentsByStatus(){ return this.repo.getAppointmentsByStatus(); }
  async getTopDoctors(limit=10)  { return this.repo.getTopDoctors(this.boundedInt(limit, 10, 1, 100)); }
  async getLabTurnaround()       { return this.repo.getLabTurnaround(); }
  async getEmergencyByESI()      { return this.repo.getEmergencyByESI(); }
  async getDrugDispensing(limit=10){ return this.repo.getDrugDispensing(this.boundedInt(limit, 10, 1, 100)); }
  async getOutstandingByAge()    { return this.repo.getOutstandingByAge(); }

  async getFullReport() {
    const [kpi, revenue, patients, apptStatus, topDocs, lab, emergency, drugs, outstanding] =
      await Promise.all([
        this.repo.getKpiSnapshot(),
        this.repo.getRevenueByDay(30),
        this.repo.getPatientsByDay(30),
        this.repo.getAppointmentsByStatus(),
        this.repo.getTopDoctors(10),
        this.repo.getLabTurnaround(),
        this.repo.getEmergencyByESI(),
        this.repo.getDrugDispensing(10),
        this.repo.getOutstandingByAge(),
      ]);
    return { kpi, revenue, patients, apptStatus, topDoctors: topDocs, lab, emergency, drugs, outstanding };
  }
}
