export enum UserRole {
  SuperAdmin   = 'super_admin',
  Admin        = 'admin',
  Doctor       = 'doctor',
  Nurse        = 'nurse',
  Receptionist = 'receptionist',
  Pharmacist   = 'pharmacist',
  LabTech      = 'lab_technician',
  Accountant   = 'accountant',
  Radiologist  = 'radiologist',
  Patient      = 'patient',
}

export interface User {
  id:                string;
  username:          string;
  email:             string;
  fullName:          string;
  roles:             UserRole[];
  isActive:          boolean;
  preferredLanguage: 'en' | 'fa' | 'ps';
  createdAt:         string;
  updatedAt:         string;
}

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}
