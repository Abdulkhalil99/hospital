import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import {
  RegisterEmergencyVisitInput, TriageInput,
  EmergencyVisitRow,
} from './emergency.types';

// ESI level → triage color mapping
const ESI_COLORS: Record<number, string> = {
  1: 'red',
  2: 'orange',
  3: 'yellow',
  4: 'green',
  5: 'blue',
};

export class EmergencyRepository {
  private db: Pool = getDb();

  // ── Visits ────────────────────────────────────────────────
  async createVisit(
    data:      RegisterEmergencyVisitInput,
    createdBy: string,
  ): Promise<EmergencyVisitRow> {
    const { rows } = await this.db.query<EmergencyVisitRow>(
      `INSERT INTO emergency.emergency_visits
         (patient_id, unknown_patient_info, chief_complaint,
          arrival_mode, status, created_by)
       VALUES ($1,$2,$3,$4,'arrived',$5)
       RETURNING *`,
      [
        data.patientId           ?? null,
        data.unknownPatientInfo  ? JSON.stringify(data.unknownPatientInfo) : null,
        data.chiefComplaint,
        data.arrivalMode,
        createdBy,
      ],
    );
    return rows[0];
  }

  async findVisitById(id: string): Promise<EmergencyVisitRow | null> {
    const { rows } = await this.db.query<EmergencyVisitRow>(
      `SELECT ev.*,
              COALESCE(
                p.first_name || ' ' || p.last_name,
                ev.unknown_patient_info->>'name',
                'Unknown Patient'
              ) AS patient_name,
              p.mrn AS patient_mrn,
              b.bed_code,
              EXTRACT(EPOCH FROM (NOW() - ev.arrived_at))/60 AS minutes_in_ed
       FROM emergency.emergency_visits ev
       LEFT JOIN patients.patients p ON p.id = ev.patient_id
       LEFT JOIN emergency.emergency_beds b ON b.id = ev.bed_id
       WHERE ev.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async getActiveDashboard(): Promise<EmergencyVisitRow[]> {
    const { rows } = await this.db.query<EmergencyVisitRow>(
      `SELECT ev.*,
              COALESCE(
                p.first_name || ' ' || p.last_name,
                ev.unknown_patient_info->>'name',
                'Unknown Patient'
              ) AS patient_name,
              p.mrn AS patient_mrn,
              b.bed_code,
              EXTRACT(EPOCH FROM (NOW() - ev.arrived_at))/60 AS minutes_in_ed
       FROM emergency.emergency_visits ev
       LEFT JOIN patients.patients p ON p.id = ev.patient_id
       LEFT JOIN emergency.emergency_beds b ON b.id = ev.bed_id
       WHERE ev.status NOT IN ('discharged','transferred','deceased','left_without_seen')
       ORDER BY
         COALESCE(ev.triage_level, 9) ASC,
         ev.arrived_at ASC`,
    );
    return rows;
  }

  async updateVisitStatus(
    id:    string,
    status: string,
    extra: Record<string, unknown> = {},
  ): Promise<EmergencyVisitRow | null> {
    const sets  = [`status = $2`, `updated_at = NOW()`];
    const vals: unknown[] = [id, status];
    let   idx = 3;
    for (const [k, v] of Object.entries(extra)) {
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    const { rows } = await this.db.query<EmergencyVisitRow>(
      `UPDATE emergency.emergency_visits
       SET ${sets.join(', ')}
       WHERE id = $1 RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  // ── Triage ────────────────────────────────────────────────
  async createTriage(
    data:      TriageInput,
    triagedBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO emergency.triage_assessments
         (visit_id, triaged_by, triaged_at, esi_level,
          temperature_c, bp_systolic, bp_diastolic, pulse_bpm,
          respiratory_rate, o2_saturation, gcs_score, pain_score,
          weight_kg, mechanism_of_injury, allergies_noted,
          medications_noted, triage_notes)
       VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        data.visitId, triagedBy, data.esiLevel,
        data.temperatureC    ?? null,
        data.bpSystolic      ?? null,
        data.bpDiastolic     ?? null,
        data.pulseBpm        ?? null,
        data.respiratoryRate ?? null,
        data.o2Saturation    ?? null,
        data.gcsScore        ?? null,
        data.painScore       ?? null,
        data.weightKg        ?? null,
        data.mechanismOfInjury ?? null,
        data.allergiesNoted    ?? null,
        data.medicationsNoted  ?? null,
        data.triageNotes       ?? null,
      ],
    );

    // Update visit with triage level and color
    await this.db.query(
      `UPDATE emergency.emergency_visits
       SET triage_level = $2,
           triage_color = $3,
           status       = 'triaged',
           updated_at   = NOW()
       WHERE id = $1`,
      [data.visitId, data.esiLevel, ESI_COLORS[data.esiLevel]],
    );

    return rows[0];
  }

  async getTriageByVisit(visitId: string) {
    const { rows } = await this.db.query(
      `SELECT ta.*, u.full_name AS triaged_by_name
       FROM emergency.triage_assessments ta
       JOIN auth.users u ON u.id = ta.triaged_by
       WHERE ta.visit_id = $1
       ORDER BY ta.triaged_at DESC`,
      [visitId],
    );
    return rows;
  }

  // ── Beds ──────────────────────────────────────────────────
  async getAvailableBeds() {
    const { rows } = await this.db.query(
      `SELECT b.*,
              ba.visit_id AS current_visit_id,
              CASE WHEN ba.visit_id IS NULL THEN 'available' ELSE 'occupied' END AS occupancy
       FROM emergency.emergency_beds b
       LEFT JOIN emergency.bed_assignments ba
         ON ba.bed_id = b.id AND ba.vacated_at IS NULL
       WHERE b.is_active = TRUE
       ORDER BY b.bed_type, b.bed_code`,
    );
    return rows;
  }

  async getAllBeds() {
    const { rows } = await this.db.query(
      `SELECT * FROM public.v_emergency_board ORDER BY bed_type, bed_code`,
    );
    return rows;
  }

  async assignBed(
    visitId:    string,
    bedId:      string,
    assignedBy: string,
    notes?:     string,
  ) {
    // Vacate any existing bed assignment for this visit
    await this.db.query(
      `UPDATE emergency.bed_assignments
       SET vacated_at = NOW()
       WHERE visit_id = $1 AND vacated_at IS NULL`,
      [visitId],
    );

    // Create new assignment
    const { rows } = await this.db.query(
      `INSERT INTO emergency.bed_assignments
         (visit_id, bed_id, assigned_by, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [visitId, bedId, assignedBy, notes ?? null],
    );

    // Update visit with bed_id
    await this.db.query(
      `UPDATE emergency.emergency_visits
       SET bed_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [visitId, bedId],
    );

    return rows[0];
  }

  async vacateBed(visitId: string): Promise<void> {
    await this.db.query(
      `UPDATE emergency.bed_assignments
       SET vacated_at = NOW()
       WHERE visit_id = $1 AND vacated_at IS NULL`,
      [visitId],
    );
    await this.db.query(
      `UPDATE emergency.emergency_visits
       SET bed_id = NULL, updated_at = NOW()
       WHERE id = $1`,
      [visitId],
    );
  }

  // ── Trauma activations ────────────────────────────────────
  async createTraumaActivation(
    visitId:    string,
    level:      string,
    mechanism:  string,
    activatedBy: string,
    notes?:     string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO emergency.trauma_activations
         (visit_id, activation_level, activated_by, activated_at, mechanism, notes)
       VALUES ($1,$2,$3,NOW(),$4,$5)
       RETURNING *`,
      [visitId, level, activatedBy, mechanism, notes ?? null],
    );
    return rows[0];
  }

  async getTraumaActivations(visitId?: string) {
    const where = visitId ? `WHERE ta.visit_id = $1` : '';
    const params = visitId ? [visitId] : [];
    const { rows } = await this.db.query(
      `SELECT ta.*,
              u.full_name AS activated_by_name,
              ev.chief_complaint,
              COALESCE(
                p.first_name || ' ' || p.last_name,
                ev.unknown_patient_info->>'name',
                'Unknown Patient'
              ) AS patient_name
       FROM emergency.trauma_activations ta
       JOIN emergency.emergency_visits ev ON ev.id = ta.visit_id
       LEFT JOIN patients.patients p ON p.id = ev.patient_id
       JOIN auth.users u ON u.id = ta.activated_by
       ${where}
       ORDER BY ta.activated_at DESC`,
      params,
    );
    return rows;
  }

  // ── Statistics ────────────────────────────────────────────
  async getTodayStats() {
    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)                                                   AS total_visits,
         COUNT(*) FILTER (WHERE triage_level = 1)                  AS level_1_count,
         COUNT(*) FILTER (WHERE triage_level = 2)                  AS level_2_count,
         COUNT(*) FILTER (WHERE triage_level IN (3,4,5))           AS level_345_count,
         COUNT(*) FILTER (WHERE status = 'discharged')             AS discharged_count,
         COUNT(*) FILTER (WHERE status NOT IN (
           'discharged','transferred','deceased','left_without_seen'
         ))                                                         AS active_count,
         AVG(EXTRACT(EPOCH FROM (
           COALESCE(discharged_at, NOW()) - arrived_at
         ))/60) FILTER (WHERE status = 'discharged')               AS avg_ed_minutes
       FROM emergency.emergency_visits
       WHERE DATE(arrived_at) = CURRENT_DATE`,
    );
    return rows[0];
  }
}
