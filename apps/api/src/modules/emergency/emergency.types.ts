export interface RegisterEmergencyVisitInput {
  // Patient may be unknown on arrival — only one is required
  patientId?:          string;
  unknownPatientInfo?: {
    name?:        string;
    ageEstimate?: number;
    description?: string;
    gender?:      string;
  };
  chiefComplaint:  string;
  arrivalMode:     'walk_in' | 'ambulance' | 'police' | 'transfer' | 'other';
}

export interface TriageInput {
  visitId:          string;
  esiLevel:         1 | 2 | 3 | 4 | 5;
  chiefComplaint?:  string;
  // Vitals at triage
  temperatureC?:    number;
  bpSystolic?:      number;
  bpDiastolic?:     number;
  pulseBpm?:        number;
  respiratoryRate?: number;
  o2Saturation?:    number;
  gcsScore?:        number;
  painScore?:       number;
  weightKg?:        number;
  mechanismOfInjury?: string;
  allergiesNoted?:  string;
  medicationsNoted?: string;
  triageNotes?:     string;
}

export interface AssignBedInput {
  visitId: string;
  bedId:   string;
  notes?:  string;
}

export interface UpdateVisitStatusInput {
  visitId:     string;
  status:      'arrived' | 'triaged' | 'in_treatment' | 'observation' | 'discharged' | 'transferred' | 'deceased' | 'left_without_seen';
  disposition?: string;
  notes?:       string;
}

export interface TraumaActivationInput {
  visitId:          string;
  activationLevel:  'level_1' | 'level_2' | 'level_3';
  mechanism:        string;
  notes?:           string;
}

export interface EmergencyVisitRow {
  id:                   string;
  patient_id:           string | null;
  unknown_patient_info: unknown;
  arrived_at:           Date;
  arrival_mode:         string;
  triage_level:         number | null;
  triage_color:         string | null;
  chief_complaint:      string;
  bed_id:               string | null;
  status:               string;
  encounter_id:         string | null;
  discharged_at:        Date | null;
  disposition:          string | null;
  created_by:           string;
  patient_name?:        string;
  patient_mrn?:         string;
  bed_code?:            string;
  minutes_in_ed?:       number;
}
