import { z } from 'zod';

export const collectSampleSchema = z.object({
  orderId:         z.string().uuid(),
  sampleType:      z.string().min(1).max(50),
  barcodeOverride: z.string().max(50).optional(),
  notes:           z.string().max(500).optional(),
});

export const receiveSampleSchema = z.object({
  barcode: z.string().min(1).max(50),
  notes:   z.string().max(500).optional(),
});

export const rejectSampleSchema = z.object({
  barcode:         z.string().min(1),
  rejectionReason: z.string().min(1).max(200),
});

export const enterResultSchema = z.object({
  sampleId:   z.string().uuid(),
  components: z.array(z.object({
    componentName: z.string().min(1).max(100),
    resultValue:   z.string().min(1).max(200),
    unit:          z.string().max(30).optional(),
  })).min(1),
});

export const validateResultSchema = z.object({
  resultIds: z.array(z.string().uuid()).min(1),
});

export const releaseResultSchema = z.object({
  resultIds: z.array(z.string().uuid()).min(1),
});

export const worklistQuerySchema = z.object({
  status:   z.string().optional(),
  urgency:  z.enum(['routine','urgent','stat']).optional(),
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
