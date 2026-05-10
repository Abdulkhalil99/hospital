import { z } from 'zod';

export const linkPatientSchema = z.object({
  patientId:    z.string().uuid().optional(),
  mrn:          z.string().trim().min(1).max(20).optional(),
  phone:        z.string().trim().min(4).max(20).optional(),
  dateOfBirth:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (data) => {
    if (data.patientId) return true;
    return Boolean(data.mrn && (data.phone || data.dateOfBirth));
  },
  { message: 'Provide patientId or MRN plus phone or date of birth.' },
);

export const cancelPortalAppointmentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
