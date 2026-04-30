const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('accessToken') : null;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!data.success || !res.ok) {
    throw new ApiError(data.error?.code ?? 'UNKNOWN', data.error?.message ?? 'Error', res.status);
  }
  return data.data as T;
}

export const patientsService = {
  search: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return req<{ data: unknown[]; pagination: unknown }>('GET', `/patients?${qs}`);
  },

  getById:    (id: string)  => req('GET', `/patients/${id}`),
  getByMrn:   (mrn: string) => req('GET', `/patients/mrn/${mrn}`),

  register: (data: unknown) => req('POST', '/patients', data),

  verifyOtp: (id: string, target: string, code: string) =>
    req('POST', `/patients/${id}/verify-otp`, { target, code, purpose: 'registration' }),

  resendOtp: (id: string, target: string, type: 'phone' | 'email') =>
    req('POST', `/patients/${id}/resend-otp`, { target, type }),

  update: (id: string, data: unknown) => req('PATCH', `/patients/${id}`, data),
  delete: (id: string)                => req('DELETE', `/patients/${id}`),

  getAllergies:  (id: string)                    => req('GET',  `/patients/${id}/allergies`),
  addAllergy:   (id: string, data: unknown)      => req('POST', `/patients/${id}/allergies`, data),
  removeAllergy:(id: string, allergyId: string)  => req('DELETE', `/patients/${id}/allergies/${allergyId}`),

  getFamilyMembers: (id: string)            => req('GET',  `/patients/${id}/family`),
  addFamilyMember:  (id: string, data: unknown) => req('POST', `/patients/${id}/family`, data),
  removeFamilyMember:(id: string, memberId: string) => req('DELETE', `/patients/${id}/family/${memberId}`),

  getMedicalHistory: (id: string) => req('GET', `/patients/${id}/medical-history`),
};
