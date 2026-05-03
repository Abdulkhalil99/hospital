import { Router }           from 'express';
import { billingController } from './billing.controller';
import { authenticate }     from '@/shared/middleware/authenticate';
import { authorize }        from '@/shared/middleware/authorize';
import { validate }         from '@/shared/middleware/validate';
import {
  createInvoiceSchema, addItemSchema,
  recordPaymentSchema, applyDiscountSchema,
  insuranceClaimSchema,
} from './billing.validation';

export const billingRouter = Router();
billingRouter.use(authenticate);

// ── Reference data ─────────────────────────────────────────────
billingRouter.get('/charge-types', billingController.getChargeTypes);

// ── Reports ────────────────────────────────────────────────────
billingRouter.get('/reports/daily',
  authorize('billing:report'),
  billingController.getDailyRevenue,
);
billingRouter.get('/reports/period',
  authorize('billing:report'),
  billingController.getRevenueByPeriod,
);
billingRouter.get('/reports/outstanding',
  authorize('billing:report'),
  billingController.getOutstandingBalances,
);
billingRouter.get('/reports/cashier',
  authorize('billing:report'),
  billingController.getCashierSummary,
);

// ── Discounts ──────────────────────────────────────────────────
billingRouter.get('/discounts/pending',
  authorize('billing:discount'),
  billingController.getPendingDiscounts,
);
billingRouter.post('/discounts/:discountId/approve',
  authorize('billing:discount'),
  billingController.approveDiscount,
);

// ── Invoices ────────────────────────────────────────────────────
billingRouter.get('/',
  authorize('billing:read'),
  billingController.listInvoices,
);
billingRouter.post('/',
  authorize('billing:invoice'),
  validate(createInvoiceSchema),
  billingController.createInvoice,
);
billingRouter.get('/:id',
  authorize('billing:read'),
  billingController.getInvoiceById,
);
billingRouter.post('/:id/issue',
  authorize('billing:invoice'),
  billingController.issueInvoice,
);
billingRouter.post('/:id/void',
  authorize('billing:invoice'),
  billingController.voidInvoice,
);

// ── Items ───────────────────────────────────────────────────────
billingRouter.post('/:id/items',
  authorize('billing:invoice'),
  validate(addItemSchema),
  billingController.addItem,
);
billingRouter.delete('/:id/items/:itemId',
  authorize('billing:invoice'),
  billingController.removeItem,
);

// ── Payments ────────────────────────────────────────────────────
billingRouter.get('/:id/payments',
  authorize('billing:read'),
  billingController.getPayments,
);
billingRouter.post('/:id/payments',
  authorize('billing:payment'),
  validate(recordPaymentSchema),
  billingController.recordPayment,
);

// ── Discounts per invoice ──────────────────────────────────────
billingRouter.post('/:id/discount',
  authorize('billing:discount'),
  validate(applyDiscountSchema),
  billingController.requestDiscount,
);

// ── Insurance ───────────────────────────────────────────────────
billingRouter.post('/:id/insurance-claim',
  authorize('billing:invoice'),
  validate(insuranceClaimSchema),
  billingController.submitInsuranceClaim,
);
