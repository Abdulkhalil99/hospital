import { Request, Response } from 'express';
import { ZodSchema } from 'zod';

const mockBillingService = {
  addItem: jest.fn(),
  recordPayment: jest.fn(),
  requestDiscount: jest.fn(),
  submitInsuranceClaim: jest.fn(),
};

jest.mock('@/modules/billing/billing.service', () => ({
  BillingService: jest.fn().mockImplementation(() => mockBillingService),
}));

import { billingController } from '@/modules/billing/billing.controller';
import {
  addItemSchema, recordPaymentSchema, applyDiscountSchema, insuranceClaimSchema,
} from '@/modules/billing/billing.validation';
import { validate } from '@/shared/middleware/validate';

describe('Invoice route request payloads', () => {
  const invoiceId = '00000000-0000-4000-8000-000000000001';
  const actor = 'cashier-user';

  beforeEach(() => jest.clearAllMocks());

  const cases = [
    {
      name: 'line item', schema: addItemSchema,
      handler: billingController.addItem, method: 'addItem' as const,
      payload: { description: 'Consultation', quantity: 1, unitPrice: 100 },
    },
    {
      name: 'payment', schema: recordPaymentSchema,
      handler: billingController.recordPayment, method: 'recordPayment' as const,
      payload: { amount: 100, paymentMethod: 'cash' },
    },
    {
      name: 'discount', schema: applyDiscountSchema,
      handler: billingController.requestDiscount, method: 'requestDiscount' as const,
      payload: { discountType: 'fixed', amount: 10, reason: 'Approved assistance' },
    },
    {
      name: 'insurance claim', schema: insuranceClaimSchema,
      handler: billingController.submitInsuranceClaim, method: 'submitInsuranceClaim' as const,
      payload: { insuranceCompany: 'Insurer', policyNumber: 'POL-001', claimAmount: 100 },
    },
  ];

  it.each(cases)('accepts a $name without repeating the URL invoice ID in JSON', async ({ schema, handler, method, payload }) => {
    const req = {
      params: { id: invoiceId },
      user: { id: actor },
      body: payload,
    } as unknown as Request;
    const response = await new Promise<unknown>((resolve, reject) => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: resolve,
      } as unknown as Response;
      validate(schema as ZodSchema)(req, res, (error) => {
        if (error) reject(error);
        else handler(req, res, reject);
      });
    });

    const expectedPayload = expect.objectContaining({ ...payload, invoiceId });
    if (method === 'addItem') {
      expect(mockBillingService[method]).toHaveBeenCalledWith(expectedPayload);
    } else {
      expect(mockBillingService[method]).toHaveBeenCalledWith(expectedPayload, actor);
    }
    expect(response).toMatchObject({ success: true });
  });

  it('always uses the URL invoice when the body includes a different invoice ID', async () => {
    const body = recordPaymentSchema.parse({
      invoiceId: '00000000-0000-4000-8000-000000000099',
      amount: 25,
      paymentMethod: 'cash',
    });
    await new Promise<void>((resolve, reject) => {
      billingController.recordPayment(
        { params: { id: invoiceId }, user: { id: actor }, body } as unknown as Request,
        { status: jest.fn().mockReturnThis(), json: () => resolve() } as unknown as Response,
        reject,
      );
    });
    expect(mockBillingService.recordPayment).toHaveBeenCalledWith(
      { invoiceId, amount: 25, paymentMethod: 'cash' }, actor,
    );
  });
});
