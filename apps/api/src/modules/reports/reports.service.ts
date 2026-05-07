import { ReportsRepository } from './reports.repository';

export class ReportsService {
  private repo = new ReportsRepository();

  async getKpiSnapshot()         { return this.repo.getKpiSnapshot(); }
  async getRevenueByDay(days=30) { return this.repo.getRevenueByDay(days); }
  async getPatientsByDay(days=30){ return this.repo.getPatientsByDay(days); }
  async getAppointmentsByStatus(){ return this.repo.getAppointmentsByStatus(); }
  async getTopDoctors(limit=10)  { return this.repo.getTopDoctors(limit); }
  async getLabTurnaround()       { return this.repo.getLabTurnaround(); }
  async getEmergencyByESI()      { return this.repo.getEmergencyByESI(); }
  async getDrugDispensing(limit=10){ return this.repo.getDrugDispensing(limit); }
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
