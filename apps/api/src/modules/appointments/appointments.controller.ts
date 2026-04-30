import { Request, Response } from 'express';
import { AppointmentsService } from './appointments.service';
import { asyncHandler }        from '@/shared/utils/async-handler';

const svc = new AppointmentsService();

export const appointmentsController = {

  getTypes: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await svc.getTypes() });
  }),

  list: asyncHandler(async (req, res) => {
    const { doctorId, patientId, date, status, page, limit } =
      req.query as Record<string, string>;
    const result = await svc.list({
      doctorId, patientId, date, status,
      page:  Number(page  ?? 1),
      limit: Number(limit ?? 20),
    });
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getById(req.params.id) });
  }),

  book: asyncHandler(async (req, res) => {
    const appt = await svc.book(req.body, req.user!.id);
    res.status(201).json({ success: true, data: appt });
  }),

  cancel: asyncHandler(async (req, res) => {
    const updated = await svc.cancel(
      req.params.id, req.body.reason, req.user!.id,
    );
    res.json({ success: true, data: updated });
  }),

  checkin: asyncHandler(async (req, res) => {
    const result = await svc.checkin(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  }),

  // Queue
  getLiveQueue: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getLiveQueue(req.params.doctorId) });
  }),

  callNext: asyncHandler(async (req, res) => {
    const token = await svc.callNext(req.params.doctorId, req.user!.id);
    res.json({ success: true, data: token });
  }),

  completeToken: asyncHandler(async (req, res) => {
    const token = await svc.completeToken(req.params.tokenId);
    res.json({ success: true, data: token });
  }),

  skipToken: asyncHandler(async (req, res) => {
    const token = await svc.skipToken(req.params.tokenId);
    res.json({ success: true, data: token });
  }),
};
