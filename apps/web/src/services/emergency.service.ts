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

export const emergencyService = {
  // Dashboard
  getDashboard:       () => req('GET', '/emergency/dashboard'),
  getTodayStats:      () => req('GET', '/emergency/stats/today'),

  // Visits
  registerVisit:      (data: unknown) => req('POST', '/emergency/visits', data),
  getVisitById:       (id: string)    => req('GET',  `/emergency/visits/${id}`),
  updateVisitStatus:  (data: unknown) => req('POST', '/emergency/visits/status', data),

  // Triage
  performTriage:      (data: unknown)     => req('POST', '/emergency/triage', data),
  getTriageByVisit:   (visitId: string)   => req('GET',  `/emergency/triage/${visitId}`),

  // Beds
  getAvailableBeds:   () => req('GET', '/emergency/beds'),
  getBedBoard:        () => req('GET', '/emergency/beds/board'),
  assignBed:          (data: unknown) => req('POST', '/emergency/beds/assign', data),

  // Trauma
  activateTrauma:       (data: unknown)     => req('POST', '/emergency/trauma', data),
  getTraumaActivations: (visitId?: string)  =>
    req('GET', `/emergency/trauma${visitId ? `?visitId=${visitId}` : ''}`),
};
