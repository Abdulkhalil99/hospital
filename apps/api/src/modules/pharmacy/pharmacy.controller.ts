import { Request, Response } from 'express';
import { PharmacyService }   from './pharmacy.service';
import { asyncHandler }      from '@/shared/utils/async-handler';

const svc = new PharmacyService();

export const pharmacyController = {

  searchDrugs: asyncHandler(async (req, res) => {
    const { q, page, limit } = req.query as Record<string,string>;
    const data = await svc.searchDrugs(q, Number(page ?? 1), Number(limit ?? 20));
    res.json({ success: true, data });
  }),

  getDrugById: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getDrugById(req.params.id) });
  }),

  getInventory: asyncHandler(async (req, res) => {
    const data = await svc.getInventory(req.query.location as string | undefined);
    res.json({ success: true, data });
  }),

  getInventoryByDrug: asyncHandler(async (req, res) => {
    const data = await svc.getInventoryByDrug(
      req.params.drugId,
      req.query.location as string | undefined,
    );
    res.json({ success: true, data });
  }),

  addStock: asyncHandler(async (req, res) => {
    const data = await svc.addStock(req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  }),

  adjustStock: asyncHandler(async (req, res) => {
    const data = await svc.adjustStock(req.body, req.user!.id);
    res.json({ success: true, data });
  }),

  getPendingPrescriptions: asyncHandler(async (_req, res) => {
    const data = await svc.getPendingPrescriptions();
    res.json({ success: true, data });
  }),

  dispense: asyncHandler(async (req, res) => {
    const result = await svc.dispense(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }),

  getDispensingHistory: asyncHandler(async (req, res) => {
    const data = await svc.getDispensingHistory(
      req.params.patientId,
      Number(req.query.limit ?? 20),
    );
    res.json({ success: true, data });
  }),

  getLowStockAlerts: asyncHandler(async (_req, res) => {
    const data = await svc.getLowStockAlerts();
    res.json({ success: true, data });
  }),
};
