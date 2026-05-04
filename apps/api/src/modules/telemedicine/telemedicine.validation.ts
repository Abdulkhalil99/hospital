import { z } from 'zod';

export const createSessionSchema = z.object({
  patientId:     z.string().uuid(),
  doctorId:      z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  scheduledAt:   z.string().datetime().optional(),
});

export const sendMessageSchema = z.object({
  message:     z.string().min(1).max(2000),
  messageType: z.enum(['text','prescription_note']).default('text'),
});

export const joinQuerySchema = z.object({
  token: z.string().min(10),
});
