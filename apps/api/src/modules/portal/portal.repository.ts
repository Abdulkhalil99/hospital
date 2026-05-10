import { getDb } from '@/infrastructure/database/db.client';

export class PortalRepository {
  private db = getDb();

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
       WHERE portal_user_id = $1 AND is_deleted = FALSE LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async findPatientForPortalLink(data: {
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
    await this.db.query(
      `UPDATE patients.patients
       SET portal_user_id = $2, updated_at = NOW(), updated_by = $2
       WHERE id = $1`,
      [patientId, userId],
    );
  }

  async getMyAppointments(patientId: string, upcoming = false) {
    const where = upcoming
      ? `AND a.scheduled_date >= CURRENT_DATE AND a.status IN ('scheduled','confirmed')`
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
      [patientId],
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
    const [diagnoses, vitals, encounters] = await Promise.all([
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
    ]);

    return {
      diagnoses:         diagnoses.rows,
      recentVitals:      vitals.rows,
      recentEncounters:  encounters.rows,
    };
  }
}
