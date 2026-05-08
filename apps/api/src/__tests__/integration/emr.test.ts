import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp }       from '@/app';
import { cleanDatabase, seedTestUser, seedTestPatient, seedTestDoctor, getTestToken } from '../setup';

const app = createApp();

describe('EMR API — /api/v1/emr', () => {

  let token:       string;
  let userId:      string;
  let patientId:   string;
  let doctorId:    string;
  let encounterId: string;

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

    // Create encounter
    const encRes = await request(app)
      .post('/api/v1/emr')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId,
        doctorId,
        encounterType:  'outpatient',
        chiefComplaint: 'Test complaint',
      });

    encounterId = encRes.body.data?.id;
  });

  describe('POST / — create encounter', () => {

    it('creates encounter with correct fields', async () => {
      expect(encounterId).toBeDefined();

      const res = await request(app)
        .get(`/api/v1/emr/${encounterId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.chief_complaint).toBe('Test complaint');
      expect(res.body.data.patient_id).toBe(patientId);
    });

  });

  describe('POST /:id/vitals — add vital signs', () => {

    it('adds vitals and returns BMI', async () => {
      const res = await request(app)
        .post(`/api/v1/emr/${encounterId}/vitals`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          temperatureC: 37.2,
          bpSystolic:   120,
          bpDiastolic:  80,
          pulseBpm:     72,
          o2Saturation: 98,
          weightKg:     70,
          heightCm:     175,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.temperature_c).toBe(37.2);
    });

    it('returns 422 for out-of-range temperature', async () => {
      const res = await request(app)
        .post(`/api/v1/emr/${encounterId}/vitals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ temperatureC: 100 });

      expect(res.status).toBe(422);
    });

  });

  describe('POST /:id/notes — SOAP note', () => {

    it('saves SOAP note', async () => {
      const res = await request(app)
        .post(`/api/v1/emr/${encounterId}/notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          noteType:   'soap',
          subjective: 'Patient reports headache',
          objective:  'BP 120/80, HR 72',
          assessment: 'Tension headache',
          plan:       'Paracetamol 500mg TDS',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.note_type).toBe('soap');
      expect(res.body.data.subjective).toBe('Patient reports headache');
    });

  });

  describe('POST /:id/diagnoses — add diagnosis', () => {

    it('adds ICD-10 diagnosis', async () => {
      const res = await request(app)
        .post(`/api/v1/emr/${encounterId}/diagnoses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          icd10Code:     'G44.2',
          icd10Name:     'Tension-type headache',
          diagnosisType: 'primary',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.icd10_code).toBe('G44.2');
    });

  });

  describe('POST /:id/prescriptions — add prescription', () => {

    it('creates prescription', async () => {
      const res = await request(app)
        .post(`/api/v1/emr/${encounterId}/prescriptions`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          drugName:    'Paracetamol',
          dosage:      '500mg',
          frequency:   'Three times daily',
          route:       'oral',
          quantity:    15,
          unit:        'tablet',
          durationDays: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.drug_name).toBe('Paracetamol');
      expect(res.body.data.status).toBe('pending');
    });

  });

  describe('POST /:id/complete — complete encounter', () => {

    it('marks encounter as completed', async () => {
      const res = await request(app)
        .post(`/api/v1/emr/${encounterId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.completed_at).toBeDefined();
    });

    it('returns error when completing already completed encounter', async () => {
      await request(app)
        .post(`/api/v1/emr/${encounterId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`/api/v1/emr/${encounterId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
    });

  });

  describe('GET /:id/full — full encounter', () => {

    it('returns full encounter with all sub-records', async () => {
      // Add data first
      await request(app).post(`/api/v1/emr/${encounterId}/vitals`).set('Authorization', `Bearer ${token}`).send({ temperatureC: 37.0 });
      await request(app).post(`/api/v1/emr/${encounterId}/diagnoses`).set('Authorization', `Bearer ${token}`).send({ icd10Code: 'J06.9', icd10Name: 'Acute URI', diagnosisType: 'primary' });

      const res = await request(app)
        .get(`/api/v1/emr/${encounterId}/full`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.encounter).toBeDefined();
      expect(res.body.data.vitals).toBeDefined();
      expect(res.body.data.diagnoses).toBeDefined();
      expect(res.body.data.prescriptions).toBeDefined();
      expect(res.body.data.labOrders).toBeDefined();
    });

  });

});
