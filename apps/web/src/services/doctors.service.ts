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

export const doctorsService = {
  list:          (params?: Record<string,string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return req('GET', `/doctors${qs}`);
  },
  getById:       (id: string)  => req('GET', `/doctors/${id}`),
  getMyProfile:  ()            => req('GET', '/doctors/me'),
  create:        (data: unknown) => req('POST', '/doctors', data),
  update:        (id: string, data: unknown) => req('PATCH', `/doctors/${id}`, data),
  delete:        (id: string)  => req('DELETE', `/doctors/${id}`),

  getSchedules:  (id: string)  => req('GET',  `/doctors/${id}/schedules`),
  setSchedule:   (id: string, data: unknown) => req('PUT', `/doctors/${id}/schedules`, data),
  deleteSchedule:(id: string, sid: string) => req('DELETE', `/doctors/${id}/schedules/${sid}`),

  getLeaves:     (id: string, upcoming = false) =>
    req('GET', `/doctors/${id}/leaves?upcoming=${upcoming}`),
  addLeave:      (id: string, data: unknown) => req('POST', `/doctors/${id}/leaves`, data),
  removeLeave:   (id: string, lid: string)   => req('DELETE', `/doctors/${id}/leaves/${lid}`),

  getAvailability: (id: string, params: Record<string,string>) => {
    const qs = new URLSearchParams(params).toString();
    return req('GET', `/doctors/${id}/availability?${qs}`);
  },

  getSpecialties: () => req('GET', '/doctors/specialties'),
  getDepartments: () => req('GET', '/doctors/departments'),
};
