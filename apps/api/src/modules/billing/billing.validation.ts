import { z } from 'zod';

export const createInvoiceSchema = z.object({
  patientId:   z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  notes:       z.string().max(500).optional(),
});

export const addItemSchema = z.object({
  invoiceId:       z.string().uuid(),
  description:     z.string().min(1).max(300),
  descriptionFa:   z.string().max(300).optional(),
  quantity:        z.number().min(0.01),
  unitPrice:       z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  chargeTypeId:    z.string().uuid().optional(),
  encounterId:     z.string().uuid().optional(),
  labOrderId:      z.string().uuid().optional(),
  dispensingId:    z.string().uuid().optional(),
  imagingOrderId:  z.string().uuid().optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId:       z.string().uuid(),
  amount:          z.number().min(0.01),
  paymentMethod:   z.enum(['cash','card','bank_transfer','insurance','mobile_pay','other']),
  referenceNumber: z.string().max(100).optional(),
  notes:           z.string().max(500).optional(),
});

export const applyDiscountSchema = z.object({
  invoiceId:    z.string().uuid(),
  discountType: z.enum(['percentage','fixed','full_waiver']),
  amount:       z.number().min(0).optional(),
  percentage:   z.number().min(0).max(100).optional(),
  reason:       z.string().min(1).max(500),
});

export const insuranceClaimSchema = z.object({
  invoiceId:        z.string().uuid(),
  insuranceCompany: z.string().min(1).max(200),
  policyNumber:     z.string().min(1).max(100),
  claimAmount:      z.number().min(0.01),
  notes:            z.string().max(500).optional(),
});

export const listInvoicesSchema = z.object({
  patientId:  z.string().uuid().optional(),
  status:     z.string().optional(),
  from:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:       z.string().transform(Number).default('1'),
  limit:      z.string().transform(Number).default('20'),
});
