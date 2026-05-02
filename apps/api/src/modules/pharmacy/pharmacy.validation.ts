import { z } from 'zod';

export const dispenseSchema = z.object({
  prescriptionId:              z.string().uuid(),
  drugId:                      z.string().uuid(),
  inventoryId:                 z.string().uuid(),
  quantityDispensed:           z.number().min(0.1),
  overrideAllergyWarning:      z.boolean().default(false),
  overrideInteractionWarning:  z.boolean().default(false),
  witnessId:                   z.string().uuid().optional(),
  notes:                       z.string().max(500).optional(),
});

export const addStockSchema = z.object({
  drugId:       z.string().uuid(),
  location:     z.string().min(1).max(100).default('main_pharmacy'),
  batchNumber:  z.string().max(100).optional(),
  quantity:     z.number().min(1),
  expiryDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  purchasePrice:z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  supplierId:   z.string().uuid().optional(),
});

export const adjustStockSchema = z.object({
  inventoryId: z.string().uuid(),
  quantity:    z.number().refine(v => v !== 0, 'Quantity cannot be zero'),
  reason:      z.enum(['adjustment','expired','wastage','return','transfer_in','transfer_out']),
  notes:       z.string().max(500).optional(),
});

export const drugSearchSchema = z.object({
  q:        z.string().optional(),
  page:     z.string().transform(Number).default('1'),
  limit:    z.string().transform(Number).default('20'),
  location: z.string().optional(),
});
