export interface CreatePatientInput {
  firstName:   string;
  lastName:    string;
  dateOfBirth: string;   // YYYY-MM-DD
  gender:      'male' | 'female' | 'other';
  bloodType:   'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
  phone:       string;
  nationalId?: string;
  email?:      string;
  address?:    string;
}

// Shape of what PostgreSQL returns — snake_case column names
export interface PatientRow {
  id:            string;
  mrn:           string;
  first_name:    string;
  last_name:     string;
  date_of_birth: string;
  gender:        string;
  blood_type:    string;
  phone:         string;
  national_id:   string | null;
  email:         string | null;
  address:       string | null;
  has_allergies: boolean;
  is_active:     boolean;
  created_at:    Date;
  updated_at:    Date;
}