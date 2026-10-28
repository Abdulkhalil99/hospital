/** A bounded FHIR R4 collection bundle for patient download, not a FHIR server. */
import { createHash } from 'crypto';
type DbDate = string | Date;
type PatientRow = { id: string; mrn: string; first_name: string; last_name: string; gender: string;
  date_of_birth: DbDate; is_active: boolean; phone?: string | null };
type AllergyRow = { id: string; allergen: string; reaction: string; severity: string; recorded_at: DbDate };
type DiagnosisRow = { id: string; icd10_code: string; icd10_name: string; created_at: DbDate };
type PrescriptionRow = { id: string; drug_name: string; generic_name?: string | null; dosage: string; route: string;
  frequency: string; instructions?: string | null; status: string; created_at: DbDate };
type VitalRow = { id: string; recorded_at: DbDate; temperature_c?: number | string | null;
  pulse_bpm?: number | string | null; respiratory_rate?: number | string | null;
  o2_saturation?: number | string | null; weight_kg?: number | string | null;
  height_cm?: number | string | null; bp_systolic?: number | string | null;
  bp_diastolic?: number | string | null };
type LabResultRow = { id: string; test_name: string; component_name: string; result_value?: string | null;
  unit?: string | null; validated_at: DbDate };
type FhirResource = { resourceType: string; id: string; [key: string]: unknown };

const date = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const instant = (value: unknown) => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const fullUrl = (resourceType: string, id: string) => {
  const hash = createHash('sha256').update(`${resourceType}:${id}`).digest('hex');
  return `urn:uuid:${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const entry = (resource: FhirResource) => ({ fullUrl: fullUrl(resource.resourceType, resource.id), resource });

export function makePatientBundle(input: {
  patient: PatientRow;
  allergies: AllergyRow[];
  diagnoses: DiagnosisRow[];
  prescriptions: PrescriptionRow[];
  vitals: VitalRow[];
  labResults: LabResultRow[];
}, generatedAt = new Date()) {
  const { patient, allergies, diagnoses, prescriptions, vitals, labResults } = input;
  const subject = { reference: fullUrl('Patient', patient.id) };
  const entries: ReturnType<typeof entry>[] = [];

  entries.push(entry({
    resourceType: 'Patient', id: patient.id, active: patient.is_active,
    identifier: [{ system: 'urn:medicore:mrn', value: patient.mrn }],
    name: [{ family: patient.last_name, given: [patient.first_name] }],
    gender: patient.gender, birthDate: date(patient.date_of_birth),
    ...(patient.phone ? { telecom: [{ system: 'phone', value: patient.phone }] } : {}),
  }));

  for (const allergy of allergies) {
    entries.push(entry({
      resourceType: 'AllergyIntolerance', id: allergy.id,
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
      patient: subject, code: { text: allergy.allergen }, recordedDate: instant(allergy.recorded_at),
      reaction: [{ manifestation: [{ text: allergy.reaction }],
        ...(allergy.severity ? { severity: allergy.severity === 'life_threatening' ? 'severe' : allergy.severity } : {}) }],
      ...(allergy.severity === 'life_threatening' || allergy.severity === 'severe' ? { criticality: 'high' } : {}),
    }));
  }

  for (const diagnosis of diagnoses) {
    entries.push(entry({
      resourceType: 'Condition', id: diagnosis.id, subject,
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] }],
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: diagnosis.icd10_code, display: diagnosis.icd10_name }] },
      recordedDate: date(diagnosis.created_at),
    }));
  }

  for (const prescription of prescriptions) {
    const status = prescription.status === 'cancelled' ? 'cancelled' : prescription.status === 'dispensed' ? 'completed' : 'active';
    entries.push(entry({
      resourceType: 'MedicationRequest', id: prescription.id, status, intent: 'order', subject,
      medicationCodeableConcept: { text: prescription.generic_name || prescription.drug_name },
      authoredOn: instant(prescription.created_at),
      dosageInstruction: [{ text: [prescription.dosage, prescription.route, prescription.frequency, prescription.instructions].filter(Boolean).join('; ') }],
    }));
  }

  const measurements = [
    ['temperature_c', 'Body temperature', 'Cel', '°C'],
    ['pulse_bpm', 'Heart rate', '/min', 'beats/min'],
    ['respiratory_rate', 'Respiratory rate', '/min', 'breaths/min'],
    ['o2_saturation', 'Oxygen saturation', '%', '%'],
    ['weight_kg', 'Body weight', 'kg', 'kg'],
    ['height_cm', 'Body height', 'cm', 'cm'],
    ['bp_systolic', 'Systolic blood pressure', 'mm[Hg]', 'mmHg'],
    ['bp_diastolic', 'Diastolic blood pressure', 'mm[Hg]', 'mmHg'],
  ] as const;
  for (const vital of vitals) {
    for (const [field, label, code, unit] of measurements) {
      if (vital[field] === null || vital[field] === undefined) continue;
      entries.push(entry({
        resourceType: 'Observation', id: `${vital.id}-${field.replace(/_/g, '-')}`,
        status: 'final', category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: { text: label }, subject, effectiveDateTime: instant(vital.recorded_at),
        valueQuantity: { value: Number(vital[field]), unit, system: 'http://unitsofmeasure.org', code },
      }));
    }
  }

  for (const result of labResults) {
    entries.push(entry({
      resourceType: 'Observation', id: result.id, status: 'final', subject,
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
      code: { text: `${result.test_name}: ${result.component_name}` },
      effectiveDateTime: instant(result.validated_at),
      ...(result.result_value !== null && result.result_value !== undefined ? { valueString: String(result.result_value) } : {}),
      ...(result.unit ? { note: [{ text: `Unit: ${result.unit}` }] } : {}),
    }));
  }

  return { resourceType: 'Bundle', type: 'collection', timestamp: generatedAt.toISOString(), entry: entries };
}
