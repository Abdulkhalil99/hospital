import { z } from 'zod';

export const registerVisitSchema = z.object({
  patientId: z.string().uuid().optional(),
  unknownPatientInfo: z.object({
    name:        z.string().max(200).optional(),
    ageEstimate: z.number().int().min(0).max(150).optional(),
    description: z.string().max(500).optional(),
    gender:      z.enum(['male','female','other']).optional(),
  }).optional(),
  chiefComplaint: z.string().min(1).max(500),
  arrivalMode:    z.enum(['walk_in','ambulance','police','transfer','other']),
}).refine(
  d => d.patientId || d.unknownPatientInfo,
  { message: 'Either patientId or unknownPatientInfo must be provided.' },
);

export const triageSchema = z.object({
  visitId:          z.string().uuid(),
  esiLevel:         z.number().int().min(1).max(5),
  chiefComplaint:   z.string().max(500).optional(),
  temperatureC:     z.number().min(30).max(45).optional(),
  bpSystolic:       z.number().int().min(50).max(300).optional(),
  bpDiastolic:      z.number().int().min(20).max(200).optional(),
  pulseBpm:         z.number().int().min(20).max(300).optional(),
  respiratoryRate:  z.number().int().min(4).max(60).optional(),
  o2Saturation:     z.number().min(50).max(100).optional(),
  gcsScore:         z.number().int().min(3).max(15).optional(),
  painScore:        z.number().int().min(0).max(10).optional(),
  weightKg:         z.number().min(0.5).max(500).optional(),
  mechanismOfInjury: z.string().max(200).optional(),
  allergiesNoted:   z.string().max(500).optional(),
  medicationsNoted: z.string().max(500).optional(),
  triageNotes:      z.string().max(2000).optional(),
});

export const assignBedSchema = z.object({
  visitId: z.string().uuid(),
  bedId:   z.string().uuid(),
  notes:   z.string().max(500).optional(),
});

export const updateStatusSchema = z.object({
  visitId:     z.string().uuid(),
  status:      z.enum([
    'arrived','triaged','in_treatment','observation',
    'discharged','transferred','deceased','left_without_seen',
  ]),
  disposition: z.string().max(100).optional(),
  notes:       z.string().max(500).optional(),
});

export const traumaSchema = z.object({
  visitId:         z.string().uuid(),
  activationLevel: z.enum(['level_1','level_2','level_3']),
  mechanism:       z.string().min(1).max(200),
  notes:           z.string().max(500).optional(),
});
