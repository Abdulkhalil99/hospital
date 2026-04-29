import { z } from 'zod';

export const createPatientSchema = z.object({
  firstName:   z.string().min(1).max(100),
  lastName:    z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  gender:      z.enum(['male', 'female', 'other']),
  bloodType:   z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']),
  phone:       z.string().min(7).max(20),
  nationalId:  z.string().max(20).optional(),
  email:       z.string().email().optional(),
  address:     z.string().max(500).optional(),
});

// For PATCH — every field optional
export const updatePatientSchema = createPatientSchema.partial();

export const searchQuerySchema = z.object({
  q:     z.string().optional(),
  page:  z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});