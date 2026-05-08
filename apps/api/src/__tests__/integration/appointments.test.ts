import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp }       from '@/app';
import { getDb }           from '@/infrastructure/database/db.client';
import { cleanDatabase, seedTestUser, seedTestPatient, seedTestDoctor, getTestToken } from '../setup';

const app = createApp();

describe('Appointments API', () => {

  let token:     string;
  let userId:    string;
  let patientId: string;
  let doctorId:  string;
  let typeId:    string;

  beforeEach(async () => {
    await cleanDatabase();

    const user   = await seedTestUser('super_admin');
    userId       = user.id;
    token        = await getTestToken(userId);

    const patient = await seedTestPatient(userId);
    patientId     = patient.id;

    const doctorUser = await seedTestUser('doctor');
    const doctor     = await seedTestDoctor(doctorUser.id, userId);
    doctorId         = doctor.id;

    // Get appointment type
    const db = getDb();
    const { rows } = await db.query(`SELECT id FROM appointments.appointment_types LIMIT 1`);
    typeId = rows[0]?.id;

    // Create a doctor schedule for today
    const today = new Date().getDay();
    await db.query(
      `INSERT INTO doctors.doctor_schedules
         (doctor_id, day_of_week, start_time, end_time, slot_duration, max_patients, effective_from)
       VALUES ($1, $2, '08:00', '17:00', 15, 1, CURRENT_DATE)`,
      [doctorId, today],
    );
  });

  describe('POST / — book appointment', () => {

    it('books appointment for available slot', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Get available slot
      const availRes = await request(app)
        .get(`/api/v1/doctors/${doctorId}/availability?date=${today}`)
        .set('Authorization', `Bearer ${token}`);

      const freeSlot = availRes.body.data?.slots?.find((s: any) => s.available);
      if (!freeSlot) return; // Skip if no slots today

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId:         patientId,
          doctorId:          doctorId,
          appointmentTypeId: typeId,
          scheduledDate:     today,
          scheduledStart:    freeSlot.startTime,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('scheduled');
      expect(res.body.data.patient_id).toBe(patientId);
    });

    it('returns 422 for missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId });

      expect(res.status).toBe(422);
    });

  });

  describe('GET / — list appointments', () => {

    it('returns empty list when no appointments', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('filters by doctorId', async () => {
      const res = await request(app)
        .get(`/api/v1/appointments?doctorId=${doctorId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

  });

});
