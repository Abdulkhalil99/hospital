import { z } from 'zod';
import { isCalendarDate } from '@/shared/utils/hospital-clock';

export const createAppointmentSchema = z.object({
  patientId:         z.string().uuid(),
  doctorId:          z.string().uuid(),
  appointmentTypeId: z.string().uuid(),
  scheduledDate:     z.string().refine(isCalendarDate, 'Choose a valid calendar date.'),
  scheduledStart:    z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  notes:             z.string().max(500).optional(),
  isWalkIn:          z.boolean().default(false),
});

export const cancelSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const listQuerySchema = z.object({
  doctorId:   z.string().uuid().optional(),
  patientId:  z.string().uuid().optional(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status:     z.string().optional(),
  page:       z.string().transform(Number).default('1'),
  limit:      z.string().transform(Number).default('20'),
});
