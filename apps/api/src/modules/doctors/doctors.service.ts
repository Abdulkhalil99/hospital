import { DoctorsRepository }  from './doctors.repository';
import { AvailabilityEngine } from './availability.engine';
import {
  CreateDoctorInput, UpdateDoctorInput,
  ScheduleInput, LeaveInput,
} from './doctors.types';
import { NotFoundError, ConflictError } from '@/shared/errors/app-error';
import { logger } from '@/infrastructure/logger/logger';

export class DoctorsService {
  private repo   = new DoctorsRepository();
  private engine = new AvailabilityEngine();

  // ── Doctors ───────────────────────────────────────────────
  async list(departmentId?: string, specialtyId?: string) {
    return this.repo.findAll(departmentId, specialtyId);
  }

  async getById(id: string) {
    const doctor = await this.repo.findById(id);
    if (!doctor) throw new NotFoundError('Doctor', id);
    return doctor;
  }

  async getByUserId(userId: string) {
    const doctor = await this.repo.findByUserId(userId);
    if (!doctor) throw new NotFoundError('Doctor profile for user', userId);
    return doctor;
  }

  async create(data: CreateDoctorInput, createdBy: string) {
    // Ensure license number is unique
    const existing = await this.repo.findByLicenseNumber(data.licenseNumber);
    if (existing) {
      throw new ConflictError(`License number '${data.licenseNumber}' is already registered.`);
    }
    // Ensure user does not already have a doctor profile
    const existingProfile = await this.repo.findByUserId(data.userId);
    if (existingProfile) {
      throw new ConflictError('This user already has a doctor profile.');
    }

    const doctor = await this.repo.create(data, createdBy);
    logger.info('Doctor profile created', { doctorId: doctor.id, userId: data.userId });
    return doctor;
  }

  async update(id: string, data: UpdateDoctorInput, updatedBy: string) {
    await this.getById(id);
    const updated = await this.repo.update(id, data, updatedBy);
    if (!updated) throw new NotFoundError('Doctor', id);
    return updated;
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    await this.getById(id);
    await this.repo.softDelete(id, deletedBy);
    logger.info('Doctor profile deactivated', { doctorId: id });
  }

  // ── Schedules ─────────────────────────────────────────────
  async getSchedules(doctorId: string) {
    await this.getById(doctorId);
    return this.repo.getSchedules(doctorId);
  }

  async setSchedule(doctorId: string, data: ScheduleInput) {
    await this.getById(doctorId);
    const schedule = await this.repo.upsertSchedule(doctorId, data);
    logger.info('Doctor schedule updated', { doctorId, dayOfWeek: data.dayOfWeek });
    return schedule;
  }

  async deleteSchedule(doctorId: string, scheduleId: string): Promise<void> {
    const deleted = await this.repo.deleteSchedule(scheduleId, doctorId);
    if (!deleted) throw new NotFoundError('Schedule', scheduleId);
  }

  // ── Leaves ────────────────────────────────────────────────
  async getLeaves(doctorId: string, upcoming = false) {
    await this.getById(doctorId);
    return this.repo.getLeaves(doctorId, upcoming);
  }

  async addLeave(doctorId: string, data: LeaveInput, approvedBy: string) {
    await this.getById(doctorId);

    // Check for overlapping leave
    const leaves = await this.repo.getLeaves(doctorId, false);
    const overlap = leaves.find(l =>
      data.startDate <= l.end_date && data.endDate >= l.start_date,
    );
    if (overlap) {
      throw new ConflictError(
        `Leave overlaps with existing leave from ${overlap.start_date} to ${overlap.end_date}.`,
      );
    }

    const leave = await this.repo.addLeave(doctorId, data, approvedBy);
    logger.info('Doctor leave added', { doctorId, startDate: data.startDate, endDate: data.endDate });
    return leave;
  }

  async removeLeave(doctorId: string, leaveId: string): Promise<void> {
    const removed = await this.repo.removeLeave(leaveId, doctorId);
    if (!removed) throw new NotFoundError('Leave', leaveId);
  }

  // ── Availability ──────────────────────────────────────────
  async getAvailability(doctorId: string, date?: string, from?: string, to?: string) {
    const doctor = await this.getById(doctorId);
    if (!doctor.is_available) {
      return { available: false, reason: 'Doctor is currently marked as unavailable.' };
    }

    if (date) {
      return this.engine.getForDate(doctorId, date);
    }
    if (from && to) {
      return this.engine.getForDateRange(doctorId, from, to);
    }
    // Default: today
    const today = new Date().toISOString().split('T')[0];
    return this.engine.getForDate(doctorId, today);
  }

  // ── Specialties and departments ───────────────────────────
  async getSpecialties() { return this.repo.getSpecialties(); }
  async getDepartments() { return this.repo.getDepartments(); }
}
