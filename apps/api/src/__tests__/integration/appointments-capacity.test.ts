import { getDb } from '@/infrastructure/database/db.client';
import { AppointmentsRepository } from '@/modules/appointments/appointments.repository';
import { CreateAppointmentInput } from '@/modules/appointments/appointments.types';
import { ConflictError } from '@/shared/errors/app-error';
import { cleanDatabase, seedTestUser, seedTestPatient, seedTestDoctor } from '../setup';

describe('Appointment capacity and queue persistence', () => {
  let repository: AppointmentsRepository;
  let userId: string;
  let data: CreateAppointmentInput;

  beforeEach(async () => {
    await cleanDatabase();
    repository = new AppointmentsRepository();
    const user = await seedTestUser();
    userId = user.id;
    const patient = await seedTestPatient(userId);
    const doctor = await seedTestDoctor(userId, userId);
    const { rows: [type] } = await getDb().query('SELECT id FROM appointments.appointment_types LIMIT 1');
    data = {
      patientId: patient.id,
      doctorId: doctor.id,
      appointmentTypeId: type.id,
      scheduledDate: '2030-01-01',
      scheduledStart: '09:00',
    };
  });

  it('allows only one simultaneous booking for a one-patient slot', async () => {
    const results = await Promise.allSettled([
      repository.create(data, '09:15', userId, 1),
      repository.create(data, '09:15', userId, 1),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
    const { rows: [count] } = await getDb().query('SELECT COUNT(*) FROM appointments.appointments');
    expect(Number(count.count)).toBe(1);
  });

  it('honors multi-patient capacity while preventing excess bookings', async () => {
    const results = await Promise.allSettled([
      repository.create(data, '09:15', userId, 2),
      repository.create(data, '09:15', userId, 2),
      repository.create(data, '09:15', userId, 2),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('updates queue status using the migrated schema', async () => {
    const appointment = await repository.create(data, '09:15', userId);
    const token = await repository.createQueueToken(appointment.id, data.patientId, data.doctorId, 3);
    const updated = await repository.updateTokenStatus(token.id, 'called', { called_at: new Date() });
    expect(updated?.status).toBe('called');
    expect(updated?.called_at).toBeInstanceOf(Date);
  });
});
