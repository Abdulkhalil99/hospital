import { getDb, withTransaction } from '@/infrastructure/database/db.client';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { verifiedLinkPatientSchema } from './portal.validation';
import { portalCodeDigest } from './portal-link';
import { hospitalClock } from '@/shared/utils/hospital-clock';

export class PortalRepository {
  private db = getDb();

  async verifyAndLinkPortalUser(userId: string, data: z.infer<typeof verifiedLinkPatientSchema>) {
    return withTransaction(async client => {
      // Account and challenge locks serialize attempts, consumption and ownership changes.
      await client.query('SELECT id FROM auth.users WHERE id=$1 FOR UPDATE', [userId]);
      const { rows: [challenge] } = await client.query(
        'SELECT * FROM patients.portal_link_challenges WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [data.challengeId, userId],
      );
      if (!challenge || challenge.used_at || challenge.attempts >= 5 || new Date(challenge.expires_at) <= new Date()) {
        return { status: 'invalid' as const };
      }
      await client.query('UPDATE patients.portal_link_challenges SET attempts=attempts+1 WHERE id=$1', [challenge.id]);
      const expected = Buffer.from(challenge.code_hash, 'hex');
      const supplied = Buffer.from(portalCodeDigest(data.challengeId, data.code), 'hex');
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return { status: 'invalid' as const };

      const { rows: [patient] } = await client.query(
        `SELECT * FROM patients.patients WHERE id=$1 AND mrn=$2 AND is_active AND NOT is_deleted
          AND ($3::uuid IS NULL OR id=$3)
          AND ($4::text IS NULL OR regexp_replace(phone, '\\D', '', 'g')=$4)
          AND ($5::date IS NULL OR date_of_birth=$5) FOR UPDATE`,
        [challenge.patient_id, data.mrn, data.patientId ?? null, data.phone?.replace(/\D/g, '') ?? null, data.dateOfBirth ?? null],
      );
      if (!patient) return { status: 'invalid' as const };
      const { rows: [linked] } = await client.query(
        `UPDATE patients.patients SET portal_user_id=$2,updated_by=$2,updated_at=NOW()
         WHERE id=$1 AND (portal_user_id IS NULL OR portal_user_id=$2)
           AND NOT EXISTS(SELECT 1 FROM patients.patients WHERE portal_user_id=$2 AND id<>$1 AND NOT is_deleted)
         RETURNING *`, [patient.id, userId],
      );
      if (!linked) return { status: 'conflict' as const };
      await client.query('UPDATE patients.portal_link_challenges SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [userId]);
      return { status: 'linked' as const, patient: linked };
    });
  }

  async getPatientById(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT *
       FROM patients.patients
       WHERE id = $1 AND is_deleted = FALSE
       LIMIT 1`,
      [patientId],
    );
    return rows[0] ?? null;
  }

  async getPatientByUserId(userId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM patients.patients
       WHERE portal_user_id = $1 AND is_deleted = FALSE AND is_active = TRUE LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async findPatientForPortalLink(data: {
    patientId?: string;
    mrn: string;
    phone?: string;
    dateOfBirth?: string;
  }) {
    const conditions = [
      'mrn = $1',
      'is_deleted = FALSE',
      'is_active = TRUE',
    ];
    const values: unknown[] = [data.mrn];
    let index = 2;

    if (data.patientId) {
      conditions.push(`id = $${index++}`);
      values.push(data.patientId);
    }

    if (data.phone) {
      conditions.push(`regexp_replace(phone, '\\D', '', 'g') = $${index++}`);
      values.push(data.phone.replace(/\D/g, ''));
    }

    if (data.dateOfBirth) {
      conditions.push(`date_of_birth = $${index++}::DATE`);
      values.push(data.dateOfBirth);
    }

    const { rows } = await this.db.query(
      `SELECT *
       FROM patients.patients
       WHERE ${conditions.join(' AND ')}
       LIMIT 1`,
      values,
    );
    return rows[0] ?? null;
  }

  async linkPortalUser(patientId: string, userId: string) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // Serialize links for this account so concurrent requests cannot attach
      // multiple patient records to one portal user.
      await client.query('SELECT id FROM auth.users WHERE id = $1 FOR UPDATE', [userId]);
      const { rows } = await client.query(
        `UPDATE patients.patients
         SET portal_user_id = $2, updated_at = NOW(), updated_by = $2
         WHERE id = $1 AND is_deleted = FALSE AND is_active = TRUE
           AND (portal_user_id IS NULL OR portal_user_id = $2)
           AND NOT EXISTS (
             SELECT 1 FROM patients.patients
             WHERE portal_user_id = $2 AND id <> $1 AND is_deleted = FALSE
           )
         RETURNING *`,
        [patientId, userId],
      );
      await client.query('COMMIT');
      return rows[0] ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMyAppointments(patientId: string, upcoming = false) {
    const where = upcoming
      ? `AND a.scheduled_date >= $2::date AND a.status IN ('scheduled','confirmed','checked_in','in_progress')`
      : '';
    const { rows } = await this.db.query(
      `SELECT a.*,
              u.full_name AS doctor_name,
              s.name AS specialty,
              at2.name AS type_name
       FROM appointments.appointments a
       JOIN doctors.doctors      d   ON d.id = a.doctor_id
       JOIN auth.users            u   ON u.id = d.user_id
       LEFT JOIN doctors.specialties s    ON s.id = d.specialty_id
       LEFT JOIN appointments.appointment_types at2 ON at2.id = a.appointment_type_id
       WHERE a.patient_id  = $1
         AND a.is_deleted  = FALSE
         ${where}
       ORDER BY a.scheduled_date DESC, a.scheduled_start DESC
       LIMIT 50`,
      upcoming ? [patientId, hospitalClock().date] : [patientId],
    );
    return rows;
  }

  async getMyLabResults(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT
         lr.*,
         lo.test_name, lo.urgency,
         ls.barcode, ls.collected_at,
         u.full_name AS ordered_by_name
       FROM laboratory.lab_results lr
       JOIN emr.lab_orders     lo ON lo.id = lr.order_id
       JOIN laboratory.lab_samples ls ON ls.id = lr.sample_id
       JOIN auth.users          u  ON u.id  = lo.ordered_by
       WHERE lr.patient_id   = $1
         AND lr.validated_at IS NOT NULL
         AND lr.released_at  IS NOT NULL
       ORDER BY lr.entered_at DESC
       LIMIT 100`,
      [patientId],
    );
    return rows;
  }

  async getMyPrescriptions(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT pr.*,
              u.full_name AS prescribed_by_name,
              e.started_at AS encounter_date
       FROM emr.prescriptions pr
       JOIN auth.users    u ON u.id = pr.prescribed_by
       JOIN emr.encounters e ON e.id = pr.encounter_id
       WHERE pr.patient_id = $1
       ORDER BY pr.created_at DESC
       LIMIT 100`,
      [patientId],
    );
    return rows;
  }

  async getMyInvoices(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT inv.*
       FROM billing.invoices inv
       WHERE inv.patient_id  = $1
         AND inv.is_deleted  = FALSE
         AND inv.status NOT IN ('draft','void')
       ORDER BY inv.created_at DESC
       LIMIT 50`,
      [patientId],
    );
    return rows;
  }

  async getMyInvoiceDetail(invoiceId: string, patientId: string) {
    const { rows: inv } = await this.db.query(
      `SELECT * FROM billing.invoices
       WHERE id = $1 AND patient_id = $2 AND is_deleted = FALSE`,
      [invoiceId, patientId],
    );
    if (!inv[0]) return null;

    const { rows: items } = await this.db.query(
      `SELECT * FROM billing.invoice_items WHERE invoice_id = $1 ORDER BY created_at`,
      [invoiceId],
    );
    const { rows: payments } = await this.db.query(
      `SELECT py.*, r.receipt_number
       FROM billing.payments py
       LEFT JOIN billing.receipts r ON r.payment_id = py.id
       WHERE py.invoice_id = $1 ORDER BY py.received_at`,
      [invoiceId],
    );

    return { invoice: inv[0], items, payments };
  }

  async getMyAllergies(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM patients.allergies
       WHERE patient_id = $1 AND is_active = TRUE
       ORDER BY severity DESC`,
      [patientId],
    );
    return rows;
  }

  async getMyProfile(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM emr.encounters e WHERE e.patient_id = p.id AND e.status = 'completed') AS total_visits,
              (SELECT MAX(started_at) FROM emr.encounters e WHERE e.patient_id = p.id) AS last_visit
       FROM patients.patients p
       WHERE p.id = $1 AND p.is_deleted = FALSE`,
      [patientId],
    );
    return rows[0] ?? null;
  }

  async getMedicalSummary(patientId: string) {
    const [diagnoses, vitals, encounters, problems] = await Promise.all([
      this.db.query(
        `SELECT DISTINCT d.icd10_code, d.icd10_name, d.diagnosis_type, MAX(d.created_at) AS last_recorded
         FROM emr.diagnoses d
         JOIN emr.encounters e ON e.id = d.encounter_id AND e.is_deleted = FALSE
         WHERE d.patient_id = $1 AND d.diagnosis_type = 'primary'
         GROUP BY d.icd10_code, d.icd10_name, d.diagnosis_type
         ORDER BY last_recorded DESC LIMIT 10`,
        [patientId],
      ),
      this.db.query(
        `SELECT vs.*
         FROM emr.vital_signs vs
         JOIN emr.encounters e ON e.id = vs.encounter_id AND e.is_deleted = FALSE
         WHERE vs.patient_id = $1
         ORDER BY vs.recorded_at DESC LIMIT 5`,
        [patientId],
      ),
      this.db.query(
        `SELECT e.id, e.started_at, e.chief_complaint, e.status, u.full_name AS doctor_name
         FROM emr.encounters e
         JOIN doctors.doctors d ON d.id = e.doctor_id
         JOIN auth.users u ON u.id = d.user_id
         WHERE e.patient_id = $1 AND e.is_deleted = FALSE AND e.status = 'completed'
         ORDER BY e.started_at DESC LIMIT 5`,
        [patientId],
      ),
      this.db.query(
        `SELECT id,icd10_code,display,notes,recorded_at FROM patients.problem_list
         WHERE patient_id=$1 AND status='active' ORDER BY recorded_at DESC LIMIT 100`,
        [patientId],
      ),
    ]);

    return {
      diagnoses:         diagnoses.rows,
      recentVitals:      vitals.rows,
      recentEncounters:  encounters.rows,
      activeProblems: problems.rows,
    };
  }
}
