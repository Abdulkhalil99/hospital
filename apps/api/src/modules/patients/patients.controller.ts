// ── Reads req, calls service, sends res. Nothing else. ───────────────

import { Request, Response } from 'express';
import { PatientsService }   from './patients.service';

const service = new PatientsService();

export const patientsController = {

  async getById(req: Request, res: Response): Promise<void> {
    const patient = await service.getById(req.params.id);
    res.json({ success: true, data: patient });
  },

  async getByMrn(req: Request, res: Response): Promise<void> {
    const patient = await service.getByMrn(req.params.mrn);
    res.json({ success: true, data: patient });
  },

  async search(req: Request, res: Response): Promise<void> {
    const { q = '', page = '1', limit = '20' } = req.query as Record<string, string>;
    const result = await service.search(q, Number(page), Number(limit));
    res.json({ success: true, ...result });
  },

  async create(req: Request, res: Response): Promise<void> {
    const patient = await service.create(req.body, req.user!.id);
    res.status(201).json({ success: true, data: patient });
  },

  async update(req: Request, res: Response): Promise<void> {
    const patient = await service.update(req.params.id, req.body, req.user!.id);
    res.json({ success: true, data: patient });
  },

  async delete(req: Request, res: Response): Promise<void> {
    await service.delete(req.params.id, req.user!.id);
    res.json({ success: true, data: null });
  },
};