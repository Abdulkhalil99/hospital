const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function req<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const authToken = token ?? (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success || !res.ok) throw new Error(data.error?.message ?? 'Error');
  return data.data as T;
}

export const telemedicineService = {
  createSession:    (data: unknown)             => req('POST', '/telemedicine', data),
  joinSession:      (token: string)             => req('GET', `/telemedicine/join?token=${token}`),
  getSession:       (id: string)                => req('GET', `/telemedicine/${id}`),
  getDoctorSessions:(doctorId: string)          => req('GET', `/telemedicine/doctor/${doctorId}`),
  getChatHistory:   (id: string)                => req('GET', `/telemedicine/${id}/chat`),
  sendChatMessage:  (id: string, data: unknown) => req('POST', `/telemedicine/${id}/chat`, data),
  endSession:       (id: string)                => req('POST', `/telemedicine/${id}/end`),
};
