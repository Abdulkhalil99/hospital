const mockRepo = { verifyAndLinkPortalUser: jest.fn() };

jest.mock('@/modules/portal/portal.repository', () => ({
  PortalRepository: jest.fn().mockImplementation(() => mockRepo),
}));
jest.mock('@/modules/appointments/appointments.service', () => ({
  AppointmentsService: jest.fn(),
}));

import { PortalService } from '@/modules/portal/portal.service';
import { verifiedLinkPatientSchema } from '@/modules/portal/portal.validation';

describe('Portal patient linking', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const data = {
    mrn: 'MRN-001', phone: '+93 700 123 456',
    challengeId: '00000000-0000-4000-8000-000000000002', code: '123456',
  };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    { ...data, phone: undefined },
    { ...data, code: undefined },
    { ...data, code: '12345' },
    { ...data, challengeId: 'invalid' },
  ])('requires identity and a valid challenge: %j', candidate => {
    expect(verifiedLinkPatientSchema.safeParse(candidate).success).toBe(false);
  });

  it('returns the record linked by the atomic repository operation', async () => {
    const patient = { id: 'patient-1', portal_user_id: userId };
    mockRepo.verifyAndLinkPortalUser.mockResolvedValue({ status: 'linked', patient });
    await expect(new PortalService().linkPatient(userId, data)).resolves.toEqual(patient);
    expect(mockRepo.verifyAndLinkPortalUser).toHaveBeenCalledWith(userId, data);
  });

  it('rejects invalid or expired challenges', async () => {
    mockRepo.verifyAndLinkPortalUser.mockResolvedValue({ status: 'invalid' });
    await expect(new PortalService().linkPatient(userId, data)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('reports an ownership conflict without claiming the link succeeded', async () => {
    mockRepo.verifyAndLinkPortalUser.mockResolvedValue({ status: 'conflict' });
    await expect(new PortalService().linkPatient(userId, data)).rejects.toMatchObject({ statusCode: 409 });
  });
});
