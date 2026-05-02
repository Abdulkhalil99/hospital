const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success || !res.ok) throw new Error(data.error?.message ?? 'Error');
  return data.data as T;
}

export const emrService = {
  createEncounter:       (data: unknown)        => req('POST', '/emr', data),
  getEncounterById:      (id: string)           => req('GET',  `/emr/${id}`),
  getFullEncounter:      (id: string)           => req('GET',  `/emr/${id}/full`),
  getEncountersByPatient:(patientId: string, page = 1) =>
    req('GET', `/emr/patient/${patientId}?page=${page}`),
  getEncountersByDoctor: (doctorId: string, date?: string) =>
    req('GET', `/emr/doctor/${doctorId}${date ? `?date=${date}` : ''}`),
  completeEncounter:     (id: string)           => req('POST', `/emr/${id}/complete`),

  addVitalSigns:         (id: string, data: unknown) => req('POST', `/emr/${id}/vitals`, data),
  getVitalSigns:         (id: string)           => req('GET',  `/emr/${id}/vitals`),

  addClinicalNote:       (id: string, data: unknown) => req('POST', `/emr/${id}/notes`, data),
  getClinicalNotes:      (id: string)           => req('GET',  `/emr/${id}/notes`),

  addDiagnosis:          (id: string, data: unknown) => req('POST', `/emr/${id}/diagnoses`, data),
  removeDiagnosis:       (id: string, dxId: string) => req('DELETE', `/emr/${id}/diagnoses/${dxId}`),
  getDiagnoses:          (id: string)           => req('GET',  `/emr/${id}/diagnoses`),

  addPrescription:       (id: string, data: unknown) => req('POST', `/emr/${id}/prescriptions`, data),
  cancelPrescription:    (id: string, rxId: string) => req('POST', `/emr/${id}/prescriptions/${rxId}/cancel`),
  getPrescriptions:      (id: string)           => req('GET',  `/emr/${id}/prescriptions`),

  addLabOrder:           (id: string, data: unknown) => req('POST', `/emr/${id}/lab-orders`, data),
  getLabOrders:          (id: string)           => req('GET',  `/emr/${id}/lab-orders`),

  addImagingOrder:       (id: string, data: unknown) => req('POST', `/emr/${id}/imaging-orders`, data),
  getImagingOrders:      (id: string)           => req('GET',  `/emr/${id}/imaging-orders`),

  getMedicalHistory:     (patientId: string)    => req('GET',  `/emr/patient/${patientId}/history`),
};
