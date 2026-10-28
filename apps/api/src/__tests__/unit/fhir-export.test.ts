import { makePatientBundle } from '@/modules/portal/fhir-export';

describe('Patient FHIR summary', () => {
  const patientId = '00000000-0000-4000-8000-000000000001';
  const patient = { id: patientId, mrn: 'MC-1', first_name: 'Sara', last_name: 'Ahmad',
    gender: 'female', date_of_birth: '1990-01-02', is_active: true, phone: '0700000000' };

  it('builds unique R4 resources with references to the same patient', () => {
    const bundle = makePatientBundle({
      patient,
      allergies: [{ id: '00000000-0000-4000-8000-000000000002', allergen: 'Penicillin', reaction: 'Rash', severity: 'severe', recorded_at: '2026-01-01T10:00:00Z' }],
      diagnoses: [{ id: '00000000-0000-4000-8000-000000000003', icd10_code: 'J06.9', icd10_name: 'Acute URI', created_at: '2026-01-02T10:00:00Z' }],
      prescriptions: [{ id: '00000000-0000-4000-8000-000000000004', drug_name: 'Drug A', dosage: '5 mg', route: 'oral', frequency: 'daily', status: 'pending', created_at: '2026-01-03T10:00:00Z' }],
      vitals: [{ id: '00000000-0000-4000-8000-000000000005', recorded_at: '2026-01-04T10:00:00Z', pulse_bpm: 72, temperature_c: 0 }],
      labResults: [{ id: '00000000-0000-4000-8000-000000000006', test_name: 'CBC', component_name: 'Hemoglobin', result_value: '<0.01', unit: 'g/dL', validated_at: '2026-01-04T12:00:00Z' }],
    }, new Date('2026-01-05T00:00:00Z'));

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.entry).toHaveLength(7);
    const urls = bundle.entry.map(item => item.fullUrl);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every(url => /^urn:uuid:[0-9a-f-]{36}$/.test(url))).toBe(true);
    const patientUrl = urls[0];
    expect(bundle.entry[0].resource).toMatchObject({ resourceType: 'Patient', birthDate: '1990-01-02' });
    for (const item of bundle.entry.slice(1)) expect(item.resource.patient ?? item.resource.subject).toEqual({ reference: patientUrl });
    expect(bundle.entry[1].resource).toMatchObject({ resourceType: 'AllergyIntolerance', criticality: 'high' });
    expect(bundle.entry[4].resource).toMatchObject({ resourceType: 'Observation', valueQuantity: { value: 0 } });
    expect(bundle.entry[6].resource).toMatchObject({ resourceType: 'Observation', valueString: '<0.01' });
  });
});
