import { z } from 'zod';

export const createEncounterSchema = z.object({
  patientId:      z.string().uuid(),
  doctorId:       z.string().uuid(),
  appointmentId:  z.string().uuid().optional(),
  encounterType:  z.enum(['outpatient','inpatient','emergency','telemedicine']).default('outpatient'),
  chiefComplaint: z.string().max(500).optional(),
});

export const vitalSignsSchema = z.object({
  temperatureC:    z.number().min(30).max(45).optional(),
  bpSystolic:      z.number().int().min(50).max(300).optional(),
  bpDiastolic:     z.number().int().min(20).max(200).optional(),
  pulseBpm:        z.number().int().min(20).max(300).optional(),
  respiratoryRate: z.number().int().min(4).max(60).optional(),
  o2Saturation:    z.number().min(50).max(100).optional(),
  weightKg:        z.number().min(0.5).max(500).optional(),
  heightCm:        z.number().min(20).max(250).optional(),
  bloodGlucose:    z.number().min(1).max(100).optional(),
  extraVitals:     z.record(z.unknown()).optional(),
  notes:           z.string().max(500).optional(),
});

export const clinicalNoteSchema = z.object({
  noteType:     z.enum(['soap','progress','procedure','discharge','addendum']),
  subjective:   z.string().max(10000).optional(),
  objective:    z.string().max(10000).optional(),
  assessment:   z.string().max(10000).optional(),
  plan:         z.string().max(10000).optional(),
  fullText:     z.string().max(10000).optional(),
  addendumToId: z.string().uuid().optional(),
});

export const diagnosisSchema = z.object({
  icd10Code:     z.string().min(3).max(10),
  icd10Name:     z.string().min(1).max(300),
  icd10NameFa:   z.string().max(300).optional(),
  diagnosisType: z.enum(['primary','secondary','differential']),
  notes:         z.string().max(1000).optional(),
});

export const prescriptionSchema = z.object({
  drugName:     z.string().min(1).max(200),
  genericName:  z.string().max(200).optional(),
  dosage:       z.string().min(1).max(100),
  frequency:    z.string().min(1).max(100),
  route:        z.enum(['oral','iv','im','sc','topical','inhaled','other']),
  durationDays: z.number().int().min(1).max(365).optional(),
  quantity:     z.number().min(0.1).max(9999),
  unit:         z.string().min(1).max(20),
  instructions: z.string().max(1000).optional(),
  isControlled: z.boolean().default(false),
});

export const labOrderSchema = z.object({
  testName:      z.string().min(1).max(200),
  testCode:      z.string().max(50).optional(),
  urgency:       z.enum(['routine','urgent','stat']).default('routine'),
  clinicalNotes: z.string().max(500).optional(),
});

export const imagingOrderSchema = z.object({
  modality:           z.enum(['xray','ct','mri','ultrasound','mammography','other']),
  bodyPart:           z.string().min(1).max(100),
  urgency:            z.enum(['routine','urgent','stat']).default('routine'),
  clinicalIndication: z.string().max(500).optional(),
});
