import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp }    from '@/app';
import { cleanDatabase, seedTestUser, getTestToken } from '../setup';

const app = createApp();

describe('Patients API — /api/v1/patients', () => {

  let token: string;
  let userId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const user = await seedTestUser('super_admin');
    userId = user.id;
    token  = await getTestToken(userId);
  });

  describe('POST / — register patient', () => {

    const validPatient = {
      firstName:         'Ahmad',
      lastName:          'Karimi',
      dateOfBirth:       '1990-05-15',
      gender:            'male',
      phone:             '0700123456',
      bloodType:         'A+',
      preferredLanguage: 'fa',
      skipOtp:           true,
    };

    it('registers a new patient and returns MRN', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send(validPatient);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patient.mrn).toMatch(/^MC-\d{4}-\d+$/);
      expect(res.body.data.patient.first_name).toBe('Ahmad');
    });

    it('returns 422 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Ahmad' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 for duplicate phone number', async () => {
      await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send(validPatient);

      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send(validPatient);

      expect(res.status).toBe(409);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .send(validPatient);

      expect(res.status).toBe(401);
    });

  });

  describe('GET / — list patients', () => {

    it('returns empty array when no patients', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns patients after registration', async () => {
      await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Test', lastName: 'Patient',
          dateOfBirth: '1985-01-01', gender: 'female',
          phone: '0700999888', skipOtp: true,
        });

      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('filters patients by search query', async () => {
      await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Unique', lastName: 'Name', dateOfBirth: '2000-01-01', gender: 'male', phone: '0700111222', skipOtp: true });

      const res = await request(app)
        .get('/api/v1/patients?q=Unique')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((p: any) => p.first_name === 'Unique')).toBe(true);
    });

  });

  describe('GET /:id — get patient by ID', () => {

    it('returns patient for valid ID', async () => {
      const createRes = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Fatima', lastName: 'Ali', dateOfBirth: '1995-06-10', gender: 'female', phone: '0700555666', skipOtp: true });

      const patientId = createRes.body.data.patient.id;

      const res = await request(app)
        .get(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.first_name).toBe('Fatima');
    });

    it('returns 404 for unknown ID', async () => {
      const res = await request(app)
        .get('/api/v1/patients/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

  });

});
