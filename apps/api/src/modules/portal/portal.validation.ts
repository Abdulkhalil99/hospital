import { z } from 'zod';

export const linkPatientSchema = z.object({
  patientId:    z.string().uuid().optional(),
  mrn:          z.string().trim().min(1).max(20),
  phone:        z.string().trim().min(4).max(20)
    .refine((phone) => phone.replace(/\D/g, '').length >= 4, 'Provide a valid phone number.')
    .optional(),
  dateOfBirth:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (data) => {
    return Boolean(data.phone || data.dateOfBirth);
  },
  { message: 'Provide MRN plus phone or date of birth.' },
);

export const cancelPortalAppointmentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
