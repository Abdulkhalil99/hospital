import { getSession, clearSession } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public code:    string,
    message:        string,
    public status:  number,
    public details?: unknown,
  ) { super(message); }
}

async function request<T>(
  method:  string,
  path:    string,
  body?:   unknown,
  token?:  string,
): Promise<T> {
  const authToken = token ?? getSession()?.accessToken;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    if (res.status === 401) {
      clearSession();
      if (typeof window !== 'undefined') window.location.href = '/';
    }
    throw new ApiError(
      data.error?.code    ?? 'UNKNOWN',
      data.error?.message ?? 'An error occurred',
      res.status,
      data.error?.details,
    );
  }

  return data.data as T;
}

export const api = {
  get:    <T>(path: string, token?: string)                  => request<T>('GET',    path, undefined, token),
  post:   <T>(path: string, body: unknown, token?: string)   => request<T>('POST',   path, body,      token),
  patch:  <T>(path: string, body: unknown, token?: string)   => request<T>('PATCH',  path, body,      token),
  put:    <T>(path: string, body: unknown, token?: string)   => request<T>('PUT',    path, body,      token),
  delete: <T>(path: string, token?: string)                  => request<T>('DELETE', path, undefined, token),
};
