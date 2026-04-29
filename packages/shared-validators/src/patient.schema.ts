import { z } from 'zod';

export const createPatientSchema = z.object({
  firstName:   z.string().min(1).max(100),
  lastName:    z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  gender:      z.enum(['male', 'female', 'other']),
  bloodType:   z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-','unknown']),
  nationalId:  z.string().max(20).optional(),
  phone:       z.string().min(7).max(20),
  email:       z.string().email().optional(),
  address:     z.string().max(500).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
