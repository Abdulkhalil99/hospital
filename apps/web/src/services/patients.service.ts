import { apiClient } from './api.client';
import type { Patient, PaginatedResponse } from '@medicore/shared-types';
import type { CreatePatientInput } from '@medicore/shared-validators';

export const patientsService = {
  list(params?: { page?: number; limit?: number; search?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient.get<PaginatedResponse<Patient>['data']>(`/patients?${query}`);
  },

  getById(id: string) {
    return apiClient.get<Patient>(`/patients/${id}`);
  },

  getByMrn(mrn: string) {
    return apiClient.get<Patient>(`/patients/mrn/${mrn}`);
  },

  create(data: CreatePatientInput) {
    return apiClient.post<Patient>('/patients', data);
  },

  update(id: string, data: Partial<CreatePatientInput>) {
    return apiClient.patch<Patient>(`/patients/${id}`, data);
  },
};