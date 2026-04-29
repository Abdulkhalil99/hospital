import type { ApiResponse } from '@medicore/shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  private getAuthHeaders(): Record<string, string> {
    // Get token from your auth store
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data: ApiResponse<T> = await res.json();

    if (!data.success || !res.ok) {
      // Throw a consistent error shape for all API failures
      throw new ApiClientError(
        data.error?.code    || 'UNKNOWN_ERROR',
        data.error?.message || 'An error occurred',
        res.status,
      );
    }

    return data.data as T;
  }

  get<T>(path: string)               { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown){ return this.request<T>('POST', path, body); }
  put<T>(path: string, body: unknown) { return this.request<T>('PUT', path, body); }
  patch<T>(path: string, body: unknown){ return this.request<T>('PATCH', path, body); }
  delete<T>(path: string)            { return this.request<T>('DELETE', path); }
}

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export const apiClient = new ApiClient();