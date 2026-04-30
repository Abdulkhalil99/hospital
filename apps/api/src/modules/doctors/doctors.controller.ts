import { Request, Response } from 'express';
import { DoctorsService }    from './doctors.service';
import { asyncHandler }      from '@/shared/utils/async-handler';

const svc = new DoctorsService();

export const doctorsController = {

  list: asyncHandler(async (req, res) => {
    const { departmentId, specialtyId } = req.query as Record<string, string>;
    const data = await svc.list(departmentId, specialtyId);
    res.json({ success: true, data });
  }),

  getById: asyncHandler(async (req, res) => {
    const doctor = await svc.getById(req.params.id);
    res.json({ success: true, data: doctor });
  }),

  getMyProfile: asyncHandler(async (req, res) => {
    const doctor = await svc.getByUserId(req.user!.id);
    res.json({ success: true, data: doctor });
  }),

  create: asyncHandler(async (req, res) => {
    const doctor = await svc.create(req.body, req.user!.id);
    res.status(201).json({ success: true, data: doctor });
  }),

  update: asyncHandler(async (req, res) => {
    const doctor = await svc.update(req.params.id, req.body, req.user!.id);
    res.json({ success: true, data: doctor });
  }),

  delete: asyncHandler(async (req, res) => {
    await svc.delete(req.params.id, req.user!.id);
    res.json({ success: true, data: null });
  }),

  // Schedules
  getSchedules: asyncHandler(async (req, res) => {
    const schedules = await svc.getSchedules(req.params.id);
    res.json({ success: true, data: schedules });
  }),

  setSchedule: asyncHandler(async (req, res) => {
    const schedule = await svc.setSchedule(req.params.id, req.body);
    res.json({ success: true, data: schedule });
  }),

  deleteSchedule: asyncHandler(async (req, res) => {
    await svc.deleteSchedule(req.params.id, req.params.scheduleId);
    res.json({ success: true, data: null });
  }),

  // Leaves
  getLeaves: asyncHandler(async (req, res) => {
    const upcoming = req.query.upcoming === 'true';
    const leaves = await svc.getLeaves(req.params.id, upcoming);
    res.json({ success: true, data: leaves });
  }),

  addLeave: asyncHandler(async (req, res) => {
    const leave = await svc.addLeave(req.params.id, req.body, req.user!.id);
    res.status(201).json({ success: true, data: leave });
  }),

  removeLeave: asyncHandler(async (req, res) => {
    await svc.removeLeave(req.params.id, req.params.leaveId);
    res.json({ success: true, data: null });
  }),

  // Availability
  getAvailability: asyncHandler(async (req, res) => {
    const { date, from, to } = req.query as Record<string, string>;
    const result = await svc.getAvailability(req.params.id, date, from, to);
    res.json({ success: true, data: result });
  }),

  // Reference data
  getSpecialties: asyncHandler(async (_req, res) => {
    const data = await svc.getSpecialties();
    res.json({ success: true, data });
  }),

  getDepartments: asyncHandler(async (_req, res) => {
    const data = await svc.getDepartments();
    res.json({ success: true, data });
  }),
};
