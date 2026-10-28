const mockGetPatientByUserId = jest.fn();
const mockQuery = jest.fn();
jest.mock('@/modules/portal/portal.repository', () => ({
  PortalRepository: jest.fn().mockImplementation(() => ({ getPatientByUserId: mockGetPatientByUserId })),
}));
jest.mock('@/infrastructure/database/db.client', () => ({ getDb: jest.fn(() => ({ query: mockQuery })) }));

import { exportMyFhirSummary } from '@/modules/portal/fhir-export.service';

describe('Patient FHIR export access', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('rejects accounts without a linked patient before querying clinical data', async () => {
    mockGetPatientByUserId.mockResolvedValue(null);
    await expect(exportMyFhirSummary('user-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('queries only the linked patient and records the export', async () => {
    const patient = { id: 'patient-1', mrn: 'MC-1', first_name: 'Sara', last_name: 'Ahmad',
      gender: 'female', date_of_birth: '1990-01-02', is_active: true };
    mockGetPatientByUserId.mockResolvedValue(patient);
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await exportMyFhirSummary('user-1');
    expect(result.bundle.entry).toHaveLength(1);
    expect(mockQuery).toHaveBeenCalledTimes(7);
    for (const call of mockQuery.mock.calls.slice(0, 6)) expect(call[1]).toEqual([patient.id]);
    expect(mockQuery.mock.calls[2][0]).toContain("status='active'");
    expect(mockQuery.mock.calls[5][0]).toContain('r.released_at IS NOT NULL');
    expect(mockQuery.mock.calls[5][0]).toContain('r.validated_at IS NOT NULL');
    expect(mockQuery.mock.calls[6][1]).toEqual(['user-1', patient.id]);
    expect(mockQuery.mock.calls[6][0]).toContain("'export'");
  });
});
