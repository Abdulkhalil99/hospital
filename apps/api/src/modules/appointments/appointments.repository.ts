import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import { CreateAppointmentInput, AppointmentRow, QueueTokenRow } from './appointments.types';

export class AppointmentsRepository {
  private db: Pool = getDb();

  async findById(id: string): Promise<AppointmentRow | null> {
    const { rows } = await this.db.query<AppointmentRow>(
      `SELECT a.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              u.full_name AS doctor_name,
              at2.name AS type_name
       FROM appointments.appointments a
       JOIN patients.patients p ON p.id = a.patient_id
       JOIN doctors.doctors d   ON d.id = a.doctor_id
       JOIN auth.users u        ON u.id = d.user_id
       LEFT JOIN appointments.appointment_types at2 ON at2.id = a.appointment_type_id
       WHERE a.id = $1 AND a.is_deleted = FALSE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(filters: {
    doctorId?: string; patientId?: string;
    date?: string; status?: string;
    limit: number; offset: number;
  }): Promise<{ rows: AppointmentRow[]; total: number }> {
    const conds: string[] = ['a.is_deleted = FALSE'];
    const vals:  unknown[] = [];
    let   i = 1;

    if (filters.doctorId)  { conds.push(`a.doctor_id       = $${i++}`); vals.push(filters.doctorId); }
    if (filters.patientId) { conds.push(`a.patient_id      = $${i++}`); vals.push(filters.patientId); }
    if (filters.date)      { conds.push(`a.scheduled_date  = $${i++}::DATE`); vals.push(filters.date); }
    if (filters.status)    { conds.push(`a.status          = $${i++}`); vals.push(filters.status); }

    const where = conds.join(' AND ');
    const { rows } = await this.db.query<AppointmentRow>(
      `SELECT a.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              u.full_name AS doctor_name,
              at2.name AS type_name
       FROM appointments.appointments a
       JOIN patients.patients p ON p.id = a.patient_id
       JOIN doctors.doctors d   ON d.id = a.doctor_id
       JOIN auth.users u        ON u.id = d.user_id
       LEFT JOIN appointments.appointment_types at2 ON at2.id = a.appointment_type_id
       WHERE ${where}
       ORDER BY a.scheduled_date ASC, a.scheduled_start ASC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, filters.limit, filters.offset],
    );
    const { rows: cr } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM appointments.appointments a WHERE ${where}`,
      vals,
    );
    return { rows, total: Number(cr[0].count) };
  }

  async isSlotTaken(
    doctorId: string, date: string, start: string,
  ): Promise<boolean> {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM appointments.appointments
       WHERE doctor_id      = $1
         AND scheduled_date = $2::DATE
         AND scheduled_start = $3::TIME
         AND status NOT IN ('cancelled','no_show')
         AND is_deleted = FALSE`,
      [doctorId, date, start],
    );
    return Number(rows[0].count) > 0;
  }

  async create(
    data: CreateAppointmentInput,
    endTime: string,
    createdBy: string,
  ): Promise<AppointmentRow> {
    const { rows } = await this.db.query<AppointmentRow>(
      `INSERT INTO appointments.appointments
         (patient_id, doctor_id, appointment_type_id,
          scheduled_date, scheduled_start, scheduled_end,
          notes, is_walk_in, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        data.patientId, data.doctorId, data.appointmentTypeId,
        data.scheduledDate, data.scheduledStart,
        endTime,
        data.notes ?? null,
        data.isWalkIn ?? false,
        createdBy,
      ],
    );
    return rows[0];
  }

  async updateStatus(
    id: string,
    status: string,
    extra: Record<string, unknown> = {},
  ): Promise<AppointmentRow | null> {
    const sets  = [`status = $2`, `updated_at = NOW()`];
    const vals: unknown[] = [id, status];
    let   i = 3;

    for (const [k, v] of Object.entries(extra)) {
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }

    const { rows } = await this.db.query<AppointmentRow>(
      `UPDATE appointments.appointments SET ${sets.join(', ')}
       WHERE id = $1 AND is_deleted = FALSE RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  async getTypes() {
    const { rows } = await this.db.query(
      `SELECT * FROM appointments.appointment_types WHERE is_active = TRUE ORDER BY name`,
    );
    return rows;
  }

  // ── Queue tokens ──────────────────────────────────────────
  async getNextTokenNumber(doctorId: string, date: string): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM appointments.queue_tokens
       WHERE doctor_id = $1 AND queue_date = $2::DATE`,
      [doctorId, date],
    );
    return Number(rows[0].count) + 1;
  }

  async createQueueToken(
    appointmentId: string, patientId: string,
    doctorId: string, priority: number,
  ): Promise<QueueTokenRow> {
    const today     = new Date().toISOString().split('T')[0];
    const tokenNum  = await this.getNextTokenNumber(doctorId, today);
    const tokenDisp = `A-${String(tokenNum).padStart(3, '0')}`;

    const { rows } = await this.db.query<QueueTokenRow>(
      `INSERT INTO appointments.queue_tokens
         (appointment_id, patient_id, doctor_id,
          token_number, token_display, queue_date, priority)
       VALUES ($1,$2,$3,$4,$5,$6::DATE,$7)
       RETURNING *`,
      [appointmentId, patientId, doctorId, tokenNum, tokenDisp, today, priority],
    );
    return rows[0];
  }

  async getLiveQueue(doctorId: string): Promise<QueueTokenRow[]> {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await this.db.query<QueueTokenRow>(
      `SELECT qt.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              u.full_name AS doctor_name
       FROM appointments.queue_tokens qt
       JOIN patients.patients p ON p.id = qt.patient_id
       JOIN doctors.doctors d   ON d.id = qt.doctor_id
       JOIN auth.users u        ON u.id = d.user_id
       WHERE qt.doctor_id  = $1
         AND qt.queue_date = $2::DATE
         AND qt.status IN ('waiting','called','in_room')
       ORDER BY qt.priority ASC, qt.token_number ASC`,
      [doctorId, today],
    );
    return rows;
  }

  async getTokenById(id: string): Promise<QueueTokenRow | null> {
    const { rows } = await this.db.query<QueueTokenRow>(
      `SELECT qt.*,
              p.first_name || ' ' || p.last_name AS patient_name
       FROM appointments.queue_tokens qt
       JOIN patients.patients p ON p.id = qt.patient_id
       WHERE qt.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updateTokenStatus(
    id: string, status: string,
    extra: Record<string, unknown> = {},
  ): Promise<QueueTokenRow | null> {
    const sets  = [`status = $2`, `updated_at = NOW()`];
    const vals: unknown[] = [id, status];
    let   i = 3;
    for (const [k, v] of Object.entries(extra)) {
      sets.push(`${k} = $${i++}`); vals.push(v);
    }
    const { rows } = await this.db.query<QueueTokenRow>(
      `UPDATE appointments.queue_tokens SET ${sets.join(', ')}
       WHERE id = $1 RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  async getAvgConsultationMinutes(doctorId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await this.db.query<{ avg: string }>(
      `SELECT AVG(wait_minutes) AS avg
       FROM appointments.queue_tokens
       WHERE doctor_id  = $1
         AND queue_date = $2::DATE
         AND status     = 'completed'
         AND wait_minutes IS NOT NULL
       LIMIT 10`,
      [doctorId, today],
    );
    return Math.round(Number(rows[0]?.avg ?? 15));
  }
}
