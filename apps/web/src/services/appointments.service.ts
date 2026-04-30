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

export const appointmentsService = {
  getTypes: ()                        => req('GET',  '/appointments/types'),
  list:     (p?: Record<string,string>) => {
    const qs = p ? '?' + new URLSearchParams(p).toString() : '';
    return req('GET', `/appointments${qs}`);
  },
  getById:  (id: string)              => req('GET',  `/appointments/${id}`),
  book:     (data: unknown)           => req('POST', '/appointments', data),
  cancel:   (id: string, reason: string) => req('POST', `/appointments/${id}/cancel`, { reason }),
  checkin:  (id: string)              => req('POST', `/appointments/${id}/checkin`),

  getLiveQueue: (doctorId: string)    => req('GET', `/appointments/queue/${doctorId}`),
  callNext:     (doctorId: string)    => req('POST', `/appointments/queue/${doctorId}/call-next`),
  completeToken:(tokenId: string)     => req('POST', `/appointments/queue/tokens/${tokenId}/complete`),
  skipToken:    (tokenId: string)     => req('POST', `/appointments/queue/tokens/${tokenId}/skip`),
};
