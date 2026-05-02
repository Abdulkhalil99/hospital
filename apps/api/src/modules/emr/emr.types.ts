export interface CreateEncounterInput {
  patientId:       string;
  doctorId:        string;
  appointmentId?:  string;
  encounterType:   'outpatient' | 'inpatient' | 'emergency' | 'telemedicine';
  chiefComplaint?: string;
}

export interface EncounterRow {
  id:                string;
  patient_id:        string;
  doctor_id:         string;
  appointment_id:    string | null;
  encounter_type:    string;
  status:            string;
  chief_complaint:   string | null;
  started_at:        Date;
  completed_at:      Date | null;
  locked_at:         Date | null;
  created_by:        string;
  version:           number;
  patient_name?:     string;
  patient_mrn?:      string;
  doctor_name?:      string;
}

export interface VitalSignsInput {
  temperatureC?:   number;
  bpSystolic?:     number;
  bpDiastolic?:    number;
  pulseBpm?:       number;
  respiratoryRate?: number;
  o2Saturation?:   number;
  weightKg?:       number;
  heightCm?:       number;
  bloodGlucose?:   number;
  extraVitals?:    Record<string, unknown>;
  notes?:          string;
}

export interface ClinicalNoteInput {
  noteType:    'soap' | 'progress' | 'procedure' | 'discharge' | 'addendum';
  subjective?: string;
  objective?:  string;
  assessment?: string;
  plan?:       string;
  fullText?:   string;
  addendumToId?: string;
}

export interface DiagnosisInput {
  icd10Code:      string;
  icd10Name:      string;
  icd10NameFa?:   string;
  diagnosisType:  'primary' | 'secondary' | 'differential';
  notes?:         string;
}

export interface PrescriptionInput {
  drugName:      string;
  genericName?:  string;
  dosage:        string;
  frequency:     string;
  route:         'oral' | 'iv' | 'im' | 'sc' | 'topical' | 'inhaled' | 'other';
  durationDays?: number;
  quantity:      number;
  unit:          string;
  instructions?: string;
  isControlled?: boolean;
}

export interface LabOrderInput {
  testName:       string;
  testCode?:      string;
  urgency:        'routine' | 'urgent' | 'stat';
  clinicalNotes?: string;
}

export interface ImagingOrderInput {
  modality:           'xray' | 'ct' | 'mri' | 'ultrasound' | 'mammography' | 'other';
  bodyPart:           string;
  urgency:            'routine' | 'urgent' | 'stat';
  clinicalIndication?: string;
}
