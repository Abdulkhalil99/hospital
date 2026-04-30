import { z } from 'zod';

export const createDoctorSchema = z.object({
  userId:           z.string().uuid(),
  licenseNumber:    z.string().min(3).max(50),
  specialtyId:      z.string().uuid().optional(),
  departmentId:     z.string().uuid().optional(),
  title:            z.string().max(20).default('Dr.'),
  bio:              z.string().max(2000).optional(),
  consultationFee:  z.number().min(0).default(0),
  licenseExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateDoctorSchema = z.object({
  specialtyId:      z.string().uuid().optional(),
  departmentId:     z.string().uuid().optional(),
  title:            z.string().max(20).optional(),
  bio:              z.string().max(2000).optional(),
  consultationFee:  z.number().min(0).optional(),
  licenseExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isAvailable:      z.boolean().optional(),
});

export const scheduleSchema = z.object({
  dayOfWeek:      z.number().int().min(0).max(6),
  startTime:      z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  endTime:        z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  slotDuration:   z.number().int().min(5).max(120).default(15),
  maxPatients:    z.number().int().min(1).max(100).default(1),
  location:       z.string().max(100).optional(),
  effectiveFrom:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(d => d.startTime < d.endTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const leaveSchema = z.object({
  leaveType: z.enum(['annual','sick','conference','emergency','other']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:    z.string().max(500).optional(),
}).refine(d => d.startDate <= d.endDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
