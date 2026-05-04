import { Request, Response }     from 'express';
import { TelemedicineService }   from './telemedicine.service';
import { asyncHandler }          from '@/shared/utils/async-handler';

const svc = new TelemedicineService();

export const telemedicineController = {

  createSession: asyncHandler(async (req, res) => {
    const result = await svc.createSession(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }),

  // Token-based join — no auth header needed (patients may not have accounts)
  joinSession: asyncHandler(async (req, res) => {
    const { token } = req.query as { token: string };
    if (!token) {
      res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'Join token required' } });
      return;
    }
    const result = await svc.joinSession(token);
    res.json({ success: true, data: result });
  }),

  getSession: asyncHandler(async (req, res) => {
    const session = await svc.getSession(req.params.id);
    res.json({ success: true, data: session });
  }),

  getDoctorSessions: asyncHandler(async (req, res) => {
    const data = await svc.getDoctorSessions(req.params.doctorId);
    res.json({ success: true, data });
  }),

  getChatHistory: asyncHandler(async (req, res) => {
    const data = await svc.getChatHistory(req.params.id);
    res.json({ success: true, data });
  }),

  sendChatMessage: asyncHandler(async (req, res) => {
    const { message, messageType, role } = req.body;
    const saved = await svc.sendChatMessage(
      req.params.id, req.user!.id,
      role ?? 'doctor', message, messageType ?? 'text',
    );
    res.status(201).json({ success: true, data: saved });
  }),

  endSession: asyncHandler(async (req, res) => {
    const updated = await svc.endSession(req.params.id, req.user!.id);
    res.json({ success: true, data: updated });
  }),
};
