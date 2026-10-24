const mockRepo = {
  getPatientByUserId: jest.fn(),
  findPatientForPortalLink: jest.fn(),
  linkPortalUser: jest.fn(),
};

jest.mock('@/modules/portal/portal.repository', () => ({
  PortalRepository: jest.fn().mockImplementation(() => mockRepo),
}));
jest.mock('@/modules/appointments/appointments.service', () => ({
  AppointmentsService: jest.fn(),
}));

import { PortalService } from '@/modules/portal/portal.service';
import { linkPatientSchema } from '@/modules/portal/portal.validation';

describe('Portal patient linking', () => {
  const patientId = '00000000-0000-4000-8000-000000000001';
  const userId = 'portal-user';
  const identity = { mrn: 'MRN-001', phone: '+93 700 123 456' };
  const patient = { id: patientId, mrn: identity.mrn, portal_user_id: null };
  const linkedPatient = { ...patient, portal_user_id: userId };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.getPatientByUserId.mockResolvedValue(null);
    mockRepo.findPatientForPortalLink.mockResolvedValue(patient);
    mockRepo.linkPortalUser.mockResolvedValue(linkedPatient);
  });

  it.each([
    { patientId },
    { patientId, mrn: identity.mrn },
    { mrn: identity.mrn },
    { mrn: identity.mrn, phone: '----' },
  ])('requires demographic matching even when a patient UUID is supplied: %j', async (data) => {
    expect(linkPatientSchema.safeParse(data).success).toBe(false);
    await expect(new PortalService().linkPatient(userId, data)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(mockRepo.findPatientForPortalLink).not.toHaveBeenCalled();
    expect(mockRepo.linkPortalUser).not.toHaveBeenCalled();
  });

  it('matches every supplied identifier before linking and returns the updated record', async () => {
    const data = { ...identity, patientId, dateOfBirth: '1990-01-02' };
    await expect(new PortalService().linkPatient(userId, data)).resolves.toEqual(linkedPatient);
    expect(mockRepo.findPatientForPortalLink).toHaveBeenCalledWith(data);
    expect(mockRepo.linkPortalUser).toHaveBeenCalledWith(patientId, userId);
  });

  it('rejects a patient record when the identifying details do not match', async () => {
    mockRepo.findPatientForPortalLink.mockResolvedValue(null);
    await expect(new PortalService().linkPatient(userId, { ...identity, patientId }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(mockRepo.linkPortalUser).not.toHaveBeenCalled();
  });

  it('does not replace another account that already owns the record', async () => {
    mockRepo.findPatientForPortalLink.mockResolvedValue({ ...patient, portal_user_id: 'other-user' });
    await expect(new PortalService().linkPatient(userId, identity))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mockRepo.linkPortalUser).not.toHaveBeenCalled();
  });

  it('reports a conflict if another linking request wins the race', async () => {
    mockRepo.linkPortalUser.mockResolvedValue(null);
    await expect(new PortalService().linkPatient(userId, identity))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not link an account to a second patient', async () => {
    mockRepo.getPatientByUserId.mockResolvedValue({ ...linkedPatient, mrn: 'OTHER-MRN' });
    await expect(new PortalService().linkPatient(userId, identity))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mockRepo.linkPortalUser).not.toHaveBeenCalled();
  });

  it('allows an idempotent retry for the same account and patient', async () => {
    mockRepo.getPatientByUserId.mockResolvedValue(linkedPatient);
    await expect(new PortalService().linkPatient(userId, identity)).resolves.toEqual(linkedPatient);
    expect(mockRepo.linkPortalUser).not.toHaveBeenCalled();
  });
});
