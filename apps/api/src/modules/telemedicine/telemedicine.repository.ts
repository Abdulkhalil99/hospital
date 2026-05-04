import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import { CreateSessionInput, SessionRow, ChatMessageRow } from './telemedicine.types';
import crypto from 'crypto';

export class TelemedicineRepository {
  private db: Pool = getDb();

  private generateToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  // ── Sessions ──────────────────────────────────────────────
  async createSession(data: CreateSessionInput, createdBy: string): Promise<SessionRow> {
    const { rows } = await this.db.query<SessionRow>(
      `INSERT INTO telemedicine.sessions
         (patient_id, doctor_id, appointment_id,
          patient_token, doctor_token, scheduled_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        data.patientId, data.doctorId,
        data.appointmentId ?? null,
        this.generateToken(),
        this.generateToken(),
        data.scheduledAt  ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  async findSessionById(id: string): Promise<SessionRow | null> {
    const { rows } = await this.db.query<SessionRow>(
      `SELECT s.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              u.full_name AS doctor_name
       FROM telemedicine.sessions s
       JOIN patients.patients p ON p.id = s.patient_id
       JOIN doctors.doctors   d ON d.id = s.doctor_id
       JOIN auth.users         u ON u.id = d.user_id
       WHERE s.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findSessionByToken(token: string): Promise<(SessionRow & {
    role: 'doctor' | 'patient';
  }) | null> {
    const { rows } = await this.db.query(
      `SELECT s.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              u.full_name AS doctor_name,
              CASE
                WHEN s.doctor_token  = $1 THEN 'doctor'
                WHEN s.patient_token = $1 THEN 'patient'
              END AS role
       FROM telemedicine.sessions s
       JOIN patients.patients p ON p.id = s.patient_id
       JOIN doctors.doctors   d ON d.id = s.doctor_id
       JOIN auth.users         u ON u.id = d.user_id
       WHERE s.doctor_token = $1 OR s.patient_token = $1`,
      [token],
    );
    return rows[0] ?? null;
  }

  async getDoctorSessions(doctorId: string): Promise<SessionRow[]> {
    const { rows } = await this.db.query<SessionRow>(
      `SELECT s.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn
       FROM telemedicine.sessions s
       JOIN patients.patients p ON p.id = s.patient_id
       WHERE s.doctor_id = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [doctorId],
    );
    return rows;
  }

  async updateSessionStatus(
    id:     string,
    status: string,
    extra:  Record<string, unknown> = {},
  ): Promise<SessionRow | null> {
    const sets  = [`status = $2`, `updated_at = NOW()`];
    const vals: unknown[] = [id, status];
    let   idx = 3;
    for (const [k, v] of Object.entries(extra)) {
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    const { rows } = await this.db.query<SessionRow>(
      `UPDATE telemedicine.sessions SET ${sets.join(', ')}
       WHERE id = $1 RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  async setConsent(sessionId: string, role: string): Promise<void> {
    if (role === 'patient') {
      await this.db.query(
        `UPDATE telemedicine.sessions
         SET patient_consent = TRUE, updated_at = NOW() WHERE id = $1`,
        [sessionId],
      );
    }
  }

  async logSignalingEvent(
    sessionId: string, eventType: string, fromRole: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO telemedicine.signaling_events
         (session_id, event_type, from_role) VALUES ($1,$2,$3)`,
      [sessionId, eventType, fromRole],
    );
  }

  // ── Chat ──────────────────────────────────────────────────
  async saveMessage(
    sessionId:   string,
    senderId:    string,
    senderRole:  string,
    message:     string,
    messageType: string,
  ): Promise<ChatMessageRow> {
    const { rows } = await this.db.query<ChatMessageRow>(
      `INSERT INTO telemedicine.chat_messages
         (session_id, sender_id, sender_role, message, message_type)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [sessionId, senderId, senderRole, message, messageType],
    );
    return rows[0];
  }

  async getChatHistory(sessionId: string): Promise<ChatMessageRow[]> {
    const { rows } = await this.db.query<ChatMessageRow>(
      `SELECT cm.*, u.full_name AS sender_name
       FROM telemedicine.chat_messages cm
       JOIN auth.users u ON u.id = cm.sender_id
       WHERE cm.session_id = $1 AND cm.is_deleted = FALSE
       ORDER BY cm.created_at ASC`,
      [sessionId],
    );
    return rows;
  }
}
