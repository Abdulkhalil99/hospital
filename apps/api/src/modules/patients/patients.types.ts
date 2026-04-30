export interface CreatePatientInput {
  firstName:          string;
  lastName:           string;
  firstNameNative?:   string;
  lastNameNative?:    string;
  dateOfBirth:        string;
  gender:             'male' | 'female' | 'other';
  bloodType:          'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
  phone:              string;
  phoneAlt?:          string;
  nationalId?:        string;
  email?:             string;
  address?:           string;
  city?:              string;
  country?:           string;
  preferredLanguage?: 'en' | 'fa' | 'ps';
  skipOtp?:           boolean;  // For emergency walk-in
}

export interface UpdatePatientInput extends Partial<CreatePatientInput> {}

export interface PatientRow {
  id:                string;
  mrn:               string;
  first_name:        string;
  last_name:         string;
  first_name_native: string | null;
  last_name_native:  string | null;
  date_of_birth:     Date;
  gender:            string;
  blood_type:        string;
  national_id:       string | null;
  phone:             string;
  phone_alt:         string | null;
  email:             string | null;
  address:           string | null;
  city:              string | null;
  country:           string;
  has_allergies:     boolean;
  is_vip:            boolean;
  portal_user_id:    string | null;
  preferred_language: string;
  is_active:         boolean;
  created_at:        Date;
  updated_at:        Date;
}

export interface AllergyInput {
  allergen:   string;
  reaction:   string;
  severity:   'mild' | 'moderate' | 'severe' | 'life_threatening';
  onsetDate?: string;
  notes?:     string;
}

export interface FamilyMemberInput {
  memberPatientId: string;
  relationship:    'spouse' | 'child' | 'parent' | 'sibling' | 'guardian' | 'caregiver' | 'other';
  accessLevel:     'view_only' | 'full' | 'guardian';
  notes?:          string;
}

export interface OtpRequest {
  target:      string;
  targetType:  'phone' | 'email';
  purpose:     'registration' | 'portal_login' | 'verify_contact' | 'password_reset';
  patientId?:  string;
}

export interface SearchParams {
  q?:      string;
  page?:   number;
  limit?:  number;
  gender?: string;
  active?: boolean;
}
