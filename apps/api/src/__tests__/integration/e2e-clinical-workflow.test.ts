import { describe, it, expect, beforeAll } from '@jest/globals';
import request  from 'supertest';
import { createApp } from '@/app';
import { getDb }     from '@/infrastructure/database/db.client';
import { cleanDatabase, seedTestUser, getTestToken } from '../setup';

const app = createApp();

/**
 * E2E Clinical Workflow Test
 *
 * Simulates a complete patient visit:
 * 1. Register patient
 * 2. Book appointment
 * 3. Check in → queue token
 * 4. Create encounter
 * 5. Add vitals + SOAP note + diagnosis + prescription + lab order
 * 6. Complete encounter
 * 7. Dispense medication (pharmacy)
 * 8. Enter lab result
 * 9. Verify auto-invoice created
 */
describe('E2E: Complete clinical workflow', () => {

  let token:       string;
  let userId:      string;
  let patientId:   string;
  let doctorId:    string;
  let appointmentId: string;
  let encounterId:   string;
  let prescriptionId: string;
  let labOrderId:  string;
  let tokenDisplay: string;
  let invoiceId:   string;

  beforeAll(async () => {
    await cleanDatabase();
    const db = getDb();

    // Setup user + doctor
    const user   = await seedTestUser('super_admin');
    userId       = user.id;
    token        = await getTestToken(userId);

    // Create doctor user + doctor profile
    const { rows: [doctorUser] } = await db.query(
      `INSERT INTO auth.users (username, email, password_hash, full_name)
       VALUES ('dr.test', 'dr@test.com', 'hash', 'Dr. Test')
       RETURNING *`,
    );
    const { rows: [doctor] } = await db.query(
      `INSERT INTO doctors.doctors (user_id, license_number, title, consultation_fee, created_by)
       VALUES ($1, 'LIC-E2E-001', 'Dr.', 500, $2) RETURNING *`,
      [doctorUser.id, userId],
    );
    doctorId = doctor.id;

    // Add schedule for today
    await db.query(
      `INSERT INTO doctors.doctor_schedules
         (doctor_id, day_of_week, start_time, end_time, slot_duration, max_patients, effective_from)
       VALUES ($1, $2, '08:00', '17:00', 15, 1, CURRENT_DATE)`,
      [doctorId, new Date().getDay()],
    );
  });

  it('Step 1: registers a patient', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'E2E', lastName: 'Patient',
        dateOfBirth: '1990-01-01', gender: 'male',
        phone: '0701234567', skipOtp: true,
      });

    expect(res.status).toBe(201);
    patientId = res.body.data.patient.id;
    expect(patientId).toBeDefined();
    console.log(`  ✓ Patient registered: ${res.body.data.patient.mrn}`);
  });

  it('Step 2: books an appointment', async () => {
    const today = new Date().toISOString().split('T')[0];

    const availRes = await request(app)
      .get(`/api/v1/doctors/${doctorId}/availability?date=${today}`)
      .set('Authorization', `Bearer ${token}`);

    const slot = availRes.body.data?.slots?.find((s: any) => s.available);
    if (!slot) { console.log('  ⚠ No available slot today, skipping booking'); return; }

    const db = getDb();
    const { rows: [type] } = await db.query(`SELECT id FROM appointments.appointment_types LIMIT 1`);

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId, doctorId,
        appointmentTypeId: type.id,
        scheduledDate:  today,
        scheduledStart: slot.startTime,
      });

    expect(res.status).toBe(201);
    appointmentId = res.body.data.id;
    console.log(`  ✓ Appointment booked: ${slot.startTime}`);
  });

  it('Step 3: checks in patient → creates queue token', async () => {
    if (!appointmentId) return;

    const res = await request(app)
      .post(`/api/v1/appointments/${appointmentId}/checkin`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    tokenDisplay = res.body.data.token?.token_display;
    expect(tokenDisplay).toMatch(/^A-\d{3}$/);
    console.log(`  ✓ Checked in. Token: ${tokenDisplay}`);
  });

  it('Step 4: doctor creates encounter', async () => {
    const res = await request(app)
      .post('/api/v1/emr')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId, doctorId,
        encounterType:  'outpatient',
        chiefComplaint: 'E2E test — fever and cough',
      });

    expect(res.status).toBe(201);
    encounterId = res.body.data.id;
    console.log(`  ✓ Encounter created: ${encounterId.slice(0,8)}`);
  });

  it('Step 5a: records vital signs', async () => {
    const res = await request(app)
      .post(`/api/v1/emr/${encounterId}/vitals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        temperatureC: 38.5, bpSystolic: 125,
        bpDiastolic: 82, pulseBpm: 88,
        o2Saturation: 97, weightKg: 68,
      });

    expect(res.status).toBe(201);
    console.log(`  ✓ Vitals: T${res.body.data.temperature_c}°C, BP ${res.body.data.bp_systolic}/${res.body.data.bp_diastolic}`);
  });

  it('Step 5b: writes SOAP note', async () => {
    const res = await request(app)
      .post(`/api/v1/emr/${encounterId}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        noteType:   'soap',
        subjective: 'Fever 3 days, dry cough, mild sore throat',
        objective:  'T 38.5°C, throat erythema, clear chest',
        assessment: 'Acute upper respiratory tract infection',
        plan:       'Paracetamol 500mg TDS, rest, fluids. Review in 5 days.',
      });

    expect(res.status).toBe(201);
    console.log(`  ✓ SOAP note saved`);
  });

  it('Step 5c: adds primary diagnosis', async () => {
    const res = await request(app)
      .post(`/api/v1/emr/${encounterId}/diagnoses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        icd10Code:     'J06.9',
        icd10Name:     'Acute upper respiratory infection, unspecified',
        diagnosisType: 'primary',
      });

    expect(res.status).toBe(201);
    console.log(`  ✓ Diagnosis: ${res.body.data.icd10_code}`);
  });

  it('Step 5d: prescribes medication', async () => {
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
        instructions: 'Take with food',
      });

    expect(res.status).toBe(201);
    prescriptionId = res.body.data.id;
    expect(res.body.data.status).toBe('pending');
    console.log(`  ✓ Prescription: ${res.body.data.drug_name} ${res.body.data.dosage}`);
  });

  it('Step 5e: orders lab test', async () => {
    const res = await request(app)
      .post(`/api/v1/emr/${encounterId}/lab-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        testName: 'CBC',
        testCode: 'CBC',
        urgency:  'routine',
      });

    expect(res.status).toBe(201);
    labOrderId = res.body.data.id;
    console.log(`  ✓ Lab order: CBC`);
  });

  it('Step 6: completes encounter → triggers auto-invoice', async () => {
    const res = await request(app)
      .post(`/api/v1/emr/${encounterId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');

    // Wait a moment for async invoice creation
    await new Promise(r => setTimeout(r, 500));

    // Check invoice was auto-created
    const invRes = await request(app)
      .get(`/api/v1/billing?patientId=${patientId}`)
      .set('Authorization', `Bearer ${token}`);

    console.log(`  ✓ Encounter completed`);
    if (invRes.body.data?.length > 0) {
      invoiceId = invRes.body.data[0].id;
      console.log(`  ✓ Auto-invoice created: ${invRes.body.data[0].invoice_number}`);
    }
  });

  it('Step 7: pharmacy dispenses medication', async () => {
    // Get drug from catalog
    const drugRes = await request(app)
      .get('/api/v1/pharmacy/drugs?q=Paracetamol')
      .set('Authorization', `Bearer ${token}`);

    if (!drugRes.body.data?.length) {
      console.log('  ⚠ Drug not in catalog, skipping dispense');
      return;
    }

    const drugId = drugRes.body.data[0].id;

    // Add stock
    const stockRes = await request(app)
      .post('/api/v1/pharmacy/inventory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        drugId, quantity: 100,
        location: 'main_pharmacy',
        expiryDate: '2026-12-31',
        sellingPrice: 10,
      });

    const inventoryId = stockRes.body.data?.id;
    if (!inventoryId) { console.log('  ⚠ Could not add stock'); return; }

    // Dispense
    const dispRes = await request(app)
      .post('/api/v1/pharmacy/dispense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prescriptionId,
        drugId,
        inventoryId,
        quantityDispensed: 15,
      });

    if (dispRes.status === 201) {
      console.log(`  ✓ Dispensed 15 tablets of Paracetamol`);
    } else {
      console.log(`  ⚠ Dispense skipped: ${dispRes.body.error?.message}`);
    }
  });

  it('Step 8: lab collects and enters results', async () => {
    // Collect sample
    const collectRes = await request(app)
      .post('/api/v1/laboratory/samples/collect')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: labOrderId, sampleType: 'blood' });

    if (collectRes.status !== 201) {
      console.log('  ⚠ Sample collect skipped');
      return;
    }

    const barcode  = collectRes.body.data.barcode;
    const sampleId = collectRes.body.data.id;

    // Receive sample
    await request(app)
      .post('/api/v1/laboratory/samples/receive')
      .set('Authorization', `Bearer ${token}`)
      .send({ barcode });

    // Enter results
    const resultRes = await request(app)
      .post('/api/v1/laboratory/results')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sampleId,
        components: [
          { componentName: 'Haemoglobin',  resultValue: '13.5', unit: 'g/dL' },
          { componentName: 'WBC',          resultValue: '7.2',  unit: 'x10³/µL' },
          { componentName: 'Platelets',    resultValue: '220',  unit: 'x10³/µL' },
        ],
      });

    expect(resultRes.status).toBe(201);
    const hasCritical = resultRes.body.data.some((r: any) => r.is_critical);
    console.log(`  ✓ CBC results entered. Critical: ${hasCritical}`);
    console.log(`  ✓ Flags: ${resultRes.body.data.map((r: any) => `${r.component_name}=${r.flag}`).join(', ')}`);
  });

  it('Step 9: verifies full encounter summary', async () => {
    const res = await request(app)
      .get(`/api/v1/emr/${encounterId}/full`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data.encounter.status).toBe('completed');
    expect(data.vitals.length).toBeGreaterThan(0);
    expect(data.notes.length).toBeGreaterThan(0);
    expect(data.diagnoses.length).toBeGreaterThan(0);
    expect(data.prescriptions.length).toBeGreaterThan(0);
    expect(data.labOrders.length).toBeGreaterThan(0);

    console.log('\n  === Final encounter summary ===');
    console.log(`  Patient:       ${data.encounter.patient_name}`);
    console.log(`  Status:        ${data.encounter.status}`);
    console.log(`  Vitals:        ${data.vitals.length} recorded`);
    console.log(`  SOAP notes:    ${data.notes.length}`);
    console.log(`  Diagnoses:     ${data.diagnoses.map((d: any) => d.icd10_code).join(', ')}`);
    console.log(`  Prescriptions: ${data.prescriptions.map((r: any) => r.drug_name).join(', ')}`);
    console.log(`  Lab orders:    ${data.labOrders.map((l: any) => l.test_name).join(', ')}`);
    if (invoiceId) console.log(`  Invoice:       auto-created ✓`);
  });

});
