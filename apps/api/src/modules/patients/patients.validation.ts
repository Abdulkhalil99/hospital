import { z } from 'zod';

export const createPatientSchema = z.object({
  firstName:        z.string().min(1).max(100),
  lastName:         z.string().min(1).max(100),
  firstNameNative:  z.string().max(100).optional(),
  lastNameNative:   z.string().max(100).optional(),
  dateOfBirth:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  gender:           z.enum(['male', 'female', 'other']),
  bloodType:        z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-','unknown'])
                     .default('unknown'),
  phone:            z.string().min(7).max(20),
  phoneAlt:         z.string().max(20).optional(),
  nationalId:       z.string().max(20).optional(),
  email:            z.string().email().optional(),
  address:          z.string().max(500).optional(),
  city:             z.string().max(100).optional(),
  country:          z.string().length(2).default('AF'),
  preferredLanguage:z.enum(['en','fa','ps']).default('fa'),
  skipOtp:          z.boolean().default(false),
});

export const updatePatientSchema = createPatientSchema.partial();

export const allergySchema = z.object({
  allergen:  z.string().min(1).max(200),
  reaction:  z.string().min(1).max(500),
  severity:  z.enum(['mild','moderate','severe','life_threatening']),
  onsetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:     z.string().max(1000).optional(),
});

export const familyMemberSchema = z.object({
  memberPatientId: z.string().uuid(),
  relationship:    z.enum(['spouse','child','parent','sibling','guardian','caregiver','other']),
  accessLevel:     z.enum(['view_only','full','guardian']),
  notes:           z.string().max(500).optional(),
});

export const searchSchema = z.object({
  q:      z.string().optional(),
  page:   z.string().transform(Number).default('1'),
  limit:  z.string().transform(Number).default('20'),
  gender: z.enum(['male','female','other']).optional(),
  active: z.string().transform(v => v === 'true').optional(),
});

export const verifyOtpSchema = z.object({
  target:    z.string().min(1),
  code:      z.string().length(6).regex(/^\d{6}$/),
  purpose:   z.enum(['registration','portal_login','verify_contact','password_reset']),
});
