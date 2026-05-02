import { Request, Response } from 'express';
import { EmrService }        from './emr.service';
import { asyncHandler }      from '@/shared/utils/async-handler';

const svc = new EmrService();

export const emrController = {

  createEncounter: asyncHandler(async (req, res) => {
    const enc = await svc.createEncounter(req.body, req.user!.id);
    res.status(201).json({ success: true, data: enc });
  }),

  getEncounterById: asyncHandler(async (req, res) => {
    const enc = await svc.getEncounterById(req.params.id, req.user!.id);
    res.json({ success: true, data: enc });
  }),

  getFullEncounter: asyncHandler(async (req, res) => {
    const full = await svc.getFullEncounter(req.params.id, req.user!.id);
    res.json({ success: true, data: full });
  }),

  getEncountersByPatient: asyncHandler(async (req, res) => {
    const { page, limit } = req.query as Record<string, string>;
    const data = await svc.getEncountersByPatient(
      req.params.patientId, Number(page ?? 1), Number(limit ?? 20),
    );
    res.json({ success: true, data });
  }),

  getEncountersByDoctor: asyncHandler(async (req, res) => {
    const data = await svc.getEncountersByDoctor(
      req.params.doctorId, req.query.date as string | undefined,
    );
    res.json({ success: true, data });
  }),

  completeEncounter: asyncHandler(async (req, res) => {
    const enc = await svc.completeEncounter(req.params.id);
    res.json({ success: true, data: enc });
  }),

  // Vitals
  addVitalSigns: asyncHandler(async (req, res) => {
    const v = await svc.addVitalSigns(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data: v });
  }),

  getVitalSigns: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getVitalSigns(req.params.id) });
  }),

  // Notes
  addClinicalNote: asyncHandler(async (req, res) => {
    const n = await svc.addClinicalNote(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data: n });
  }),

  getClinicalNotes: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getClinicalNotes(req.params.id) });
  }),

  // Diagnoses
  addDiagnosis: asyncHandler(async (req, res) => {
    const d = await svc.addDiagnosis(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data: d });
  }),

  removeDiagnosis: asyncHandler(async (req, res) => {
    await svc.removeDiagnosis(req.params.id, req.params.diagnosisId);
    res.json({ success: true, data: null });
  }),

  getDiagnoses: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getDiagnoses(req.params.id) });
  }),

  // Prescriptions
  addPrescription: asyncHandler(async (req, res) => {
    const rx = await svc.addPrescription(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data: rx });
  }),

  cancelPrescription: asyncHandler(async (req, res) => {
    await svc.cancelPrescription(req.params.id, req.params.prescriptionId);
    res.json({ success: true, data: null });
  }),

  getPrescriptions: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getPrescriptions(req.params.id) });
  }),

  // Lab orders
  addLabOrder: asyncHandler(async (req, res) => {
    const lo = await svc.addLabOrder(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data: lo });
  }),

  getLabOrders: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getLabOrders(req.params.id) });
  }),

  // Imaging orders
  addImagingOrder: asyncHandler(async (req, res) => {
    const io = await svc.addImagingOrder(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data: io });
  }),

  getImagingOrders: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await svc.getImagingOrders(req.params.id) });
  }),

  // Medical history
  getMedicalHistory: asyncHandler(async (req, res) => {
    const data = await svc.getMedicalHistory(req.params.patientId, req.user!.id);
    res.json({ success: true, data });
  }),
};
