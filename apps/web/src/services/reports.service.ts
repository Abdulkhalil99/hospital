import { api } from '@/lib/api';

export const reportsService = {
  getKpi:              () => api.get('/reports/kpi'),
  getRevenueByDay:     (days=30) => api.get(`/reports/revenue?days=${days}`),
  getPatientsByDay:    (days=30) => api.get(`/reports/patients?days=${days}`),
  getApptByStatus:     () => api.get('/reports/appointments'),
  getTopDoctors:       (limit=10) => api.get(`/reports/doctors?limit=${limit}`),
  getLabTurnaround:    () => api.get('/reports/lab'),
  getEmergencyByESI:   () => api.get('/reports/emergency'),
  getDrugDispensing:   (limit=10) => api.get(`/reports/drugs?limit=${limit}`),
  getOutstandingByAge: () => api.get('/reports/outstanding'),
  getFullReport:       () => api.get('/reports/full'),
};
