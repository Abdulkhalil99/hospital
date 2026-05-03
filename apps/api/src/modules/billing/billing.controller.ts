import { Request, Response } from 'express';
import { BillingService }    from './billing.service';
import { asyncHandler }      from '@/shared/utils/async-handler';

const svc = new BillingService();

export const billingController = {

  getChargeTypes: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.getChargeTypes() });
  }),

  createInvoice: asyncHandler(async (req, res) => {
    const inv = await svc.createInvoice(req.body, req.user!.id);
    res.status(201).json({ success: true, data: inv });
  }),

  listInvoices: asyncHandler(async (req, res) => {
    const { patientId, status, from, to, page, limit } =
      req.query as Record<string, string>;
    const result = await svc.listInvoices({
      patientId, status, from, to,
      page: Number(page ?? 1), limit: Number(limit ?? 20),
    });
    res.json({ success: true, ...result });
  }),

  getInvoiceById: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getInvoiceById(req.params.id) });
  }),

  issueInvoice: asyncHandler(async (req, res) => {
    const inv = await svc.issueInvoice(req.params.id, req.user!.id);
    res.json({ success: true, data: inv });
  }),

  voidInvoice: asyncHandler(async (req, res) => {
    const inv = await svc.voidInvoice(req.params.id, req.user!.id);
    res.json({ success: true, data: inv });
  }),

  // Items
  addItem: asyncHandler(async (req, res) => {
    const item = await svc.addItem({ ...req.body, invoiceId: req.params.id });
    res.status(201).json({ success: true, data: item });
  }),

  removeItem: asyncHandler(async (req, res) => {
    await svc.removeItem(req.params.id, req.params.itemId);
    res.json({ success: true, data: null });
  }),

  // Payments
  recordPayment: asyncHandler(async (req, res) => {
    const result = await svc.recordPayment(
      { ...req.body, invoiceId: req.params.id }, req.user!.id,
    );
    res.status(201).json({ success: true, data: result });
  }),

  getPayments: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getPayments(req.params.id) });
  }),

  // Discounts
  requestDiscount: asyncHandler(async (req, res) => {
    const result = await svc.requestDiscount(
      { ...req.body, invoiceId: req.params.id }, req.user!.id,
    );
    res.status(201).json({ success: true, data: result });
  }),

  approveDiscount: asyncHandler(async (req, res) => {
    const result = await svc.approveDiscount(req.params.discountId, req.user!.id);
    res.json({ success: true, data: result });
  }),

  getPendingDiscounts: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.getPendingDiscounts() });
  }),

  // Insurance
  submitInsuranceClaim: asyncHandler(async (req, res) => {
    const result = await svc.submitInsuranceClaim(
      { ...req.body, invoiceId: req.params.id }, req.user!.id,
    );
    res.status(201).json({ success: true, data: result });
  }),

  // Reports
  getDailyRevenue: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getDailyRevenue(req.query.date as string) });
  }),

  getRevenueByPeriod: asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    res.json({ success: true, data: await svc.getRevenueByPeriod(from, to) });
  }),

  getOutstandingBalances: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.getOutstandingBalances() });
  }),

  getCashierSummary: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getCashierSummary(req.query.date as string) });
  }),
};
