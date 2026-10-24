const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};
const mockDb = {
  query: jest.fn(),
  connect: jest.fn(),
};

jest.mock('@/infrastructure/database/db.client', () => ({
  getDb: jest.fn(() => mockDb),
}));

import { PortalRepository } from '@/modules/portal/portal.repository';

describe('PortalRepository linking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [] });
  });

  it('uses the patient UUID as an additional condition alongside the identity details', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'patient-1' }] });
    await new PortalRepository().findPatientForPortalLink({
      patientId: 'patient-1', mrn: 'MRN-001', phone: '+93 700-123-456', dateOfBirth: '1990-01-02',
    });
    const [query, values] = mockDb.query.mock.calls[0];
    expect(query).toContain('mrn = $1');
    expect(query).toContain('id = $2');
    expect(query).toContain("regexp_replace(phone, '\\D', '', 'g') = $3");
    expect(query).toContain('date_of_birth = $4::DATE');
    expect(values).toEqual(['MRN-001', 'patient-1', '93700123456', '1990-01-02']);
  });

  it('locks the account and conditionally links an available record in one transaction', async () => {
    const linked = { id: 'patient-1', portal_user_id: 'user-1' };
    mockClient.query.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockResolvedValueOnce({ rows: [linked] });
    await expect(new PortalRepository().linkPortalUser('patient-1', 'user-1')).resolves.toEqual(linked);
    expect(mockClient.query.mock.calls[0]).toEqual(['BEGIN']);
    expect(mockClient.query.mock.calls[1]).toEqual([
      'SELECT id FROM auth.users WHERE id = $1 FOR UPDATE', ['user-1'],
    ]);
    const [update, values] = mockClient.query.mock.calls[2];
    expect(update).toContain('(portal_user_id IS NULL OR portal_user_id = $2)');
    expect(update).toContain('WHERE portal_user_id = $2 AND id <> $1 AND is_deleted = FALSE');
    expect(values).toEqual(['patient-1', 'user-1']);
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('does not claim success when the ownership condition blocks the update', async () => {
    await expect(new PortalRepository().linkPortalUser('patient-1', 'user-1')).resolves.toBeNull();
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the connection when linking fails', async () => {
    const failure = new Error('Database unavailable');
    mockClient.query.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockRejectedValueOnce(failure);
    await expect(new PortalRepository().linkPortalUser('patient-1', 'user-1')).rejects.toBe(failure);
    expect(mockClient.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});
