import { Request, Response }  from 'express';
import { PatientsService }    from './patients.service';
import { asyncHandler }       from '@/shared/utils/async-handler';

const svc = new PatientsService();

export const patientsController = {

  search: asyncHandler(async (req, res) => {
    const { q, page, limit, gender, active } = req.query as Record<string, string>;
    const result = await svc.search({
      q, gender,
      page:   Number(page  ?? 1),
      limit:  Number(limit ?? 20),
      active: active !== undefined ? active === 'true' : undefined,
    });
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req, res) => {
    const patient = await svc.getById(req.params.id);
    res.json({ success: true, data: patient });
  }),

  getByMrn: asyncHandler(async (req, res) => {
    const patient = await svc.getByMrn(req.params.mrn);
    res.json({ success: true, data: patient });
  }),

  register: asyncHandler(async (req, res) => {
    const result = await svc.register(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }),

  verifyOtp: asyncHandler(async (req, res) => {
    const { target, code } = req.body;
    await svc.verifyRegistrationOtp(req.params.id, target, code);
    res.json({ success: true, data: { message: 'Contact verified successfully.' } });
  }),

  resendOtp: asyncHandler(async (req, res) => {
    const { target, type } = req.body;
    const result = await svc.resendOtp(req.params.id, target, type);
    res.json({ success: true, data: result });
  }),

  update: asyncHandler(async (req, res) => {
    const patient = await svc.update(req.params.id, req.body, req.user!.id);
    res.json({ success: true, data: patient });
  }),

  delete: asyncHandler(async (req, res) => {
    await svc.delete(req.params.id, req.user!.id);
    res.json({ success: true, data: null });
  }),

  // Allergies
  getAllergies: asyncHandler(async (req, res) => {
    const data = await svc.getAllergies(req.params.id);
    res.json({ success: true, data });
  }),

  addAllergy: asyncHandler(async (req, res) => {
    const allergy = await svc.addAllergy(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data: allergy });
  }),

  removeAllergy: asyncHandler(async (req, res) => {
    await svc.removeAllergy(req.params.id, req.params.allergyId);
    res.json({ success: true, data: null });
  }),

  // Family
  getFamilyMembers: asyncHandler(async (req, res) => {
    const data = await svc.getFamilyMembers(req.params.id);
    res.json({ success: true, data });
  }),

  addFamilyMember: asyncHandler(async (req, res) => {
    const data = await svc.addFamilyMember(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  }),

  removeFamilyMember: asyncHandler(async (req, res) => {
    await svc.removeFamilyMember(req.params.id, req.params.memberId, req.user!.id);
    res.json({ success: true, data: null });
  }),

  // Medical history
  getMedicalHistory: asyncHandler(async (req, res) => {
    const data = await svc.getMedicalHistory(req.params.id, req.user!.id);
    res.json({ success: true, data });
  }),
};
