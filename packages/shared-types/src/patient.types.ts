export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
export type Gender    = 'male' | 'female' | 'other';

export interface Patient {
  id:          string;
  mrn:         string;
  firstName:   string;
  lastName:    string;
  dateOfBirth: string;
  gender:      Gender;
  bloodType:   BloodType;
  nationalId?: string;
  phone:       string;
  email?:      string;
  address?:    string;
  hasAllergies: boolean;
  isActive:    boolean;
  createdAt:   string;
  updatedAt:   string;
}

export interface Allergy {
  id:        string;
  patientId: string;
  allergen:  string;
  reaction:  string;
  severity:  'mild' | 'moderate' | 'severe' | 'life_threatening';
  recordedAt: string;
}
