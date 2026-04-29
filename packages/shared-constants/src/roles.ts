export const ROLES = {
  SUPER_ADMIN:   'super_admin',
  ADMIN:         'admin',
  DOCTOR:        'doctor',
  NURSE:         'nurse',
  RECEPTIONIST:  'receptionist',
  PHARMACIST:    'pharmacist',
  LAB_TECH:      'lab_technician',
  ACCOUNTANT:    'accountant',
  RADIOLOGIST:   'radiologist',
  PATIENT:       'patient',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
