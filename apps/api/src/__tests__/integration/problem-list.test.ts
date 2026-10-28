import request from 'supertest';
import { createApp } from '@/app';
import { getDb } from '@/infrastructure/database/db.client';
import { cleanDatabase, seedTestPatient, seedTestUser, getTestToken } from '../setup';

const app = createApp();

describe('Longitudinal problem list', () => {
  beforeEach(cleanDatabase);

  it('creates, resolves, and reopens a condition without changing another patient', async () => {
    const user = await seedTestUser();
    const token = await getTestToken(user.id);
    const first = await seedTestPatient(user.id);
    const { rows: [second] } = await getDb().query(`INSERT INTO patients.patients
      (first_name,last_name,date_of_birth,gender,phone,mrn,created_by)
      VALUES('Other','Patient','1980-01-01','female','0700000001','TEST-002',$1) RETURNING id`, [user.id]);
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app).post(`/api/v1/patients/${first.id}/problems`).set(auth)
      .send({ icd10Code: 'i10', display: 'Hypertension', notes: 'Confirmed at follow-up' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ patient_id: first.id, icd10_code: 'I10', status: 'active' });

    const duplicate = await request(app).post(`/api/v1/patients/${first.id}/problems`).set(auth)
      .send({ icd10Code: 'I10', display: 'Hypertension' });
    expect(duplicate.status).toBe(409);

    const secondList = await request(app).get(`/api/v1/patients/${second.id}/problems`).set(auth);
    expect(secondList.status).toBe(200);
    expect(secondList.body.data).toEqual([]);

    const id = created.body.data.id;
    const wrongPatient = await request(app).patch(`/api/v1/patients/${second.id}/problems/${id}`).set(auth)
      .send({ status: 'resolved' });
    expect(wrongPatient.status).toBe(404);

    const resolved = await request(app).patch(`/api/v1/patients/${first.id}/problems/${id}`).set(auth)
      .send({ status: 'resolved' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.resolved_at).toBeTruthy();

    const reopened = await request(app).patch(`/api/v1/patients/${first.id}/problems/${id}`).set(auth)
      .send({ status: 'active' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.resolved_at).toBeNull();

    const firstList = await request(app).get(`/api/v1/patients/${first.id}/problems`).set(auth);
    expect(firstList.body.data).toHaveLength(1);
    expect(firstList.body.data[0].status).toBe('active');

    const portalUser = await seedTestUser('patient');
    await getDb().query('UPDATE patients.patients SET portal_user_id=$2 WHERE id=$1', [first.id, portalUser.id]);
    const portalToken = await getTestToken(portalUser.id, ['patient']);
    const summary = await request(app).get('/api/v1/portal/summary').set('Authorization', `Bearer ${portalToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.activeProblems).toEqual([expect.objectContaining({ icd10_code: 'I10' })]);

    const exported = await request(app).get('/api/v1/portal/export/fhir').set('Authorization', `Bearer ${portalToken}`);
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('application/fhir+json');
    expect(exported.headers['cache-control']).toBe('no-store');
    const bundle = JSON.parse(exported.text);
    expect(bundle.entry.some((item: any) => item.resource.resourceType === 'Condition' &&
      item.resource.code.coding[0].code === 'I10')).toBe(true);
  });
});
