const mockClient = { query: jest.fn() };

jest.mock('@/infrastructure/database/db.client', () => ({
  getDb: jest.fn(() => ({ query: jest.fn() })),
  withTransaction: jest.fn((work: (client: typeof mockClient) => Promise<unknown>) => work(mockClient)),
}));

import { PortalRepository } from '@/modules/portal/portal.repository';
import { portalCodeDigest } from '@/modules/portal/portal-link';

describe('Verified portal linking transaction', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const patientId = '00000000-0000-4000-8000-000000000002';
  const challengeId = '00000000-0000-4000-8000-000000000003';
  const data = { mrn: 'MRN-001', phone: '+93 700 123 456', challengeId, code: '123456' };
  const challenge = { id: challengeId, patient_id: patientId, attempts: 0, used_at: null,
    expires_at: new Date(Date.now() + 60000), code_hash: portalCodeDigest(challengeId, data.code) };

  beforeEach(() => { jest.clearAllMocks(); });

  it('verifies identity, claims the patient, and consumes the code in one transaction', async () => {
    const patient = { id: patientId, portal_user_id: userId };
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: userId }] })
      .mockResolvedValueOnce({ rows: [challenge] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: patientId }] })
      .mockResolvedValueOnce({ rows: [patient] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(new PortalRepository().verifyAndLinkPortalUser(userId, data))
      .resolves.toEqual({ status: 'linked', patient });
    const queries = mockClient.query.mock.calls.map(([sql]) => sql);
    expect(queries[4]).toContain('portal_user_id=$2');
    expect(queries[5]).toContain('used_at=NOW()');
  });

  it('does not claim or consume a patient for an incorrect code', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: userId }] })
      .mockResolvedValueOnce({ rows: [challenge] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(new PortalRepository().verifyAndLinkPortalUser(userId, { ...data, code: '654321' }))
      .resolves.toEqual({ status: 'invalid' });
    expect(mockClient.query).toHaveBeenCalledTimes(3);
  });

  it('keeps a verified challenge available when ownership changed first', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: userId }] })
      .mockResolvedValueOnce({ rows: [challenge] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: patientId }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(new PortalRepository().verifyAndLinkPortalUser(userId, data))
      .resolves.toEqual({ status: 'conflict' });
    expect(mockClient.query.mock.calls.some(([sql]) => sql.includes('used_at=NOW()'))).toBe(false);
  });
});
