import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import { CreateDoctorInput, UpdateDoctorInput, DoctorRow, ScheduleInput, LeaveInput } from './doctors.types';

export class DoctorsRepository {
  private db: Pool = getDb();

  async findAll(departmentId?: string, specialtyId?: string): Promise<DoctorRow[]> {
    const params: unknown[] = [];
    const conditions: string[] = ['d.is_deleted = FALSE', 'd.is_active = TRUE'];

    if (departmentId) { params.push(departmentId); conditions.push(`d.department_id = $${params.length}`); }
    if (specialtyId)  { params.push(specialtyId);  conditions.push(`d.specialty_id  = $${params.length}`); }

    const { rows } = await this.db.query<DoctorRow>(
      `SELECT d.*,
              u.full_name, u.email,
              s.name AS specialty_name,
              dept.name AS department_name
       FROM doctors.doctors d
       JOIN auth.users          u    ON u.id   = d.user_id
       LEFT JOIN doctors.specialties s    ON s.id   = d.specialty_id
       LEFT JOIN doctors.departments dept ON dept.id = d.department_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.full_name`,
      params,
    );
    return rows;
  }

  async findById(id: string): Promise<DoctorRow | null> {
    const { rows } = await this.db.query<DoctorRow>(
      `SELECT d.*,
              u.full_name, u.email,
              s.name AS specialty_name,
              dept.name AS department_name
       FROM doctors.doctors d
       JOIN auth.users          u    ON u.id   = d.user_id
       LEFT JOIN doctors.specialties s    ON s.id   = d.specialty_id
       LEFT JOIN doctors.departments dept ON dept.id = d.department_id
       WHERE d.id = $1 AND d.is_deleted = FALSE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByUserId(userId: string): Promise<DoctorRow | null> {
    const { rows } = await this.db.query<DoctorRow>(
      `SELECT d.*, u.full_name, u.email,
              s.name AS specialty_name, dept.name AS department_name
       FROM doctors.doctors d
       JOIN auth.users u ON u.id = d.user_id
       LEFT JOIN doctors.specialties s    ON s.id = d.specialty_id
       LEFT JOIN doctors.departments dept ON dept.id = d.department_id
       WHERE d.user_id = $1 AND d.is_deleted = FALSE`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async findByLicenseNumber(licenseNumber: string): Promise<DoctorRow | null> {
    const { rows } = await this.db.query<DoctorRow>(
      `SELECT * FROM doctors.doctors WHERE license_number = $1 AND is_deleted = FALSE`,
      [licenseNumber],
    );
    return rows[0] ?? null;
  }

  async create(data: CreateDoctorInput, createdBy: string): Promise<DoctorRow> {
    const { rows } = await this.db.query<DoctorRow>(
      `INSERT INTO doctors.doctors
         (user_id, license_number, specialty_id, department_id, title,
          bio, consultation_fee, license_expires_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        data.userId, data.licenseNumber,
        data.specialtyId ?? null, data.departmentId ?? null,
        data.title ?? 'Dr.',
        data.bio ?? null,
        data.consultationFee ?? 0,
        data.licenseExpiresAt ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  async update(id: string, data: UpdateDoctorInput, updatedBy: string): Promise<DoctorRow | null> {
    const colMap: Record<string, string> = {
      specialtyId: 'specialty_id', departmentId: 'department_id',
      title: 'title', bio: 'bio',
      consultationFee: 'consultation_fee',
      licenseExpiresAt: 'license_expires_at',
      isAvailable: 'is_available',
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(colMap)) {
      if (key in data) {
        sets.push(`${col} = $${idx++}`);
        vals.push((data as Record<string, unknown>)[key] ?? null);
      }
    }
    if (!sets.length) return this.findById(id);

    sets.push(`updated_by = $${idx++}`, `updated_at = NOW()`);
    vals.push(updatedBy, id);

    const { rows } = await this.db.query<DoctorRow>(
      `UPDATE doctors.doctors SET ${sets.join(', ')}
       WHERE id = $${idx} AND is_deleted = FALSE RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE doctors.doctors
       SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND is_deleted = FALSE`,
      [deletedBy, id],
    );
    return (rowCount ?? 0) > 0;
  }

  // ── Schedules ─────────────────────────────────────────────
  async getSchedules(doctorId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM doctors.doctor_schedules
       WHERE doctor_id = $1 AND is_active = TRUE
       ORDER BY day_of_week, start_time`,
      [doctorId],
    );
    return rows;
  }

  async upsertSchedule(doctorId: string, data: ScheduleInput): Promise<unknown> {
    const { rows } = await this.db.query(
      `INSERT INTO doctors.doctor_schedules
         (doctor_id, day_of_week, start_time, end_time,
          slot_duration, max_patients, location, effective_from, effective_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (doctor_id, day_of_week, start_time, effective_from)
         WHERE is_active = TRUE
       DO UPDATE SET
         end_time      = EXCLUDED.end_time,
         slot_duration = EXCLUDED.slot_duration,
         max_patients  = EXCLUDED.max_patients,
         location      = EXCLUDED.location,
         effective_until = EXCLUDED.effective_until
       RETURNING *`,
      [
        doctorId, data.dayOfWeek, data.startTime, data.endTime,
        data.slotDuration, data.maxPatients,
        data.location ?? null,
        data.effectiveFrom ?? new Date().toISOString().split('T')[0],
        data.effectiveUntil ?? null,
      ],
    );
    return rows[0];
  }

  async deleteSchedule(scheduleId: string, doctorId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE doctors.doctor_schedules SET is_active = FALSE
       WHERE id = $1 AND doctor_id = $2`,
      [scheduleId, doctorId],
    );
    return (rowCount ?? 0) > 0;
  }

  async getScheduleForDate(doctorId: string, date: Date) {
    const dayOfWeek = date.getDay();
    const dateStr   = date.toISOString().split('T')[0];

    const { rows } = await this.db.query(
      `SELECT * FROM doctors.doctor_schedules
       WHERE doctor_id   = $1
         AND day_of_week = $2
         AND is_active   = TRUE
         AND effective_from <= $3
         AND (effective_until IS NULL OR effective_until >= $3)
       ORDER BY effective_from DESC LIMIT 1`,
      [doctorId, dayOfWeek, dateStr],
    );
    return rows[0] ?? null;
  }

  // ── Leaves ────────────────────────────────────────────────
  async getLeaves(doctorId: string, upcoming = false) {
    const { rows } = await this.db.query(
      `SELECT * FROM doctors.doctor_leaves
       WHERE doctor_id = $1
         AND ($2 = FALSE OR end_date >= CURRENT_DATE)
       ORDER BY start_date DESC`,
      [doctorId, upcoming],
    );
    return rows;
  }

  async addLeave(doctorId: string, data: LeaveInput, approvedBy: string) {
    const { rows } = await this.db.query(
      `INSERT INTO doctors.doctor_leaves
         (doctor_id, leave_type, start_date, end_date, reason, approved_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [doctorId, data.leaveType, data.startDate, data.endDate, data.reason ?? null, approvedBy],
    );
    return rows[0];
  }

  async removeLeave(leaveId: string, doctorId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `DELETE FROM doctors.doctor_leaves WHERE id = $1 AND doctor_id = $2`,
      [leaveId, doctorId],
    );
    return (rowCount ?? 0) > 0;
  }

  async isOnLeave(doctorId: string, date: string): Promise<boolean> {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM doctors.doctor_leaves
       WHERE doctor_id = $1 AND $2::DATE BETWEEN start_date AND end_date`,
      [doctorId, date],
    );
    return Number(rows[0].count) > 0;
  }

  // ── Booking counts for availability ──────────────────────
  async getBookingCounts(doctorId: string, date: string): Promise<Map<string, number>> {
    const { rows } = await this.db.query<{ scheduled_start: string; count: string }>(
      `SELECT scheduled_start::TEXT, COUNT(*) AS count
       FROM appointments.appointments
       WHERE doctor_id    = $1
         AND scheduled_date = $2::DATE
         AND status NOT IN ('cancelled', 'no_show')
         AND is_deleted = FALSE
       GROUP BY scheduled_start`,
      [doctorId, date],
    );
    const map = new Map<string, number>();
    rows.forEach(r => map.set(r.scheduled_start.slice(0, 5), Number(r.count)));
    return map;
  }

  // ── Specialties and departments ───────────────────────────
  async getSpecialties() {
    const { rows } = await this.db.query(
      `SELECT s.*, d.name AS department_name
       FROM doctors.specialties s
       LEFT JOIN doctors.departments d ON d.id = s.department_id
       ORDER BY s.name`,
    );
    return rows;
  }

  async getDepartments() {
    const { rows } = await this.db.query(
      `SELECT * FROM doctors.departments WHERE is_active = TRUE ORDER BY name`,
    );
    return rows;
  }
}
