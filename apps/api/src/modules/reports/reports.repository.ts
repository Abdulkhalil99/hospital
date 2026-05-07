import { getDb } from '@/infrastructure/database/db.client';

export class ReportsRepository {
  private db = getDb();

  async getKpiSnapshot() {
    const today = new Date().toISOString().split('T')[0];
    const [patients, doctors, appts, revenue, emergency, lab] = await Promise.all([
      this.db.query<{ count: string; new_today: string }>(
        `SELECT COUNT(*) AS count,
                COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS new_today
         FROM patients.patients WHERE is_deleted = FALSE`,
      ),
      this.db.query<{ count: string; available: string }>(
        `SELECT COUNT(*) AS count,
                COUNT(*) FILTER (WHERE is_available = TRUE) AS available
         FROM doctors.doctors WHERE is_deleted = FALSE`,
      ),
      this.db.query<{ total: string; today: string; completed: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE scheduled_date = CURRENT_DATE) AS today,
                COUNT(*) FILTER (WHERE status = 'completed' AND scheduled_date = CURRENT_DATE) AS completed
         FROM appointments.appointments WHERE is_deleted = FALSE`,
      ),
      this.db.query<{ today: string; month: string }>(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE DATE(received_at) = CURRENT_DATE), 0) AS today,
           COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', received_at) = DATE_TRUNC('month', NOW())), 0) AS month
         FROM billing.payments WHERE is_refunded = FALSE`,
      ),
      this.db.query<{ active: string; level1: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status NOT IN ('discharged','transferred','deceased','left_without_seen')) AS active,
           COUNT(*) FILTER (WHERE triage_level = 1 AND DATE(arrived_at) = CURRENT_DATE) AS level1
         FROM emergency.emergency_visits`,
      ),
      this.db.query<{ pending: string; critical: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('ordered','sample_collected')) AS pending,
           COUNT(*) FILTER (WHERE acknowledged_at IS NULL) AS critical
         FROM emr.lab_orders lo
         LEFT JOIN laboratory.critical_value_alerts cva ON cva.ordering_doctor_id = (
           SELECT doctor_id FROM emr.encounters WHERE id = lo.encounter_id LIMIT 1
         )`,
      ),
    ]);

    return {
      patients:  { total: Number(patients.rows[0].count), newToday: Number(patients.rows[0].new_today) },
      doctors:   { total: Number(doctors.rows[0].count),  available: Number(doctors.rows[0].available) },
      appointments: { total: Number(appts.rows[0].total), today: Number(appts.rows[0].today), completed: Number(appts.rows[0].completed) },
      revenue:   { today: Number(revenue.rows[0].today),  month: Number(revenue.rows[0].month) },
      emergency: { active: Number(emergency.rows[0].active), level1Today: Number(emergency.rows[0].level1) },
      lab:       { pending: Number(lab.rows[0].pending), criticalAlerts: Number(lab.rows[0].critical) },
    };
  }

  async getRevenueByDay(days = 30) {
    const { rows } = await this.db.query<{ date: string; revenue: string; transactions: string }>(
      `SELECT
         DATE(received_at)       AS date,
         SUM(amount)::NUMERIC    AS revenue,
         COUNT(*)                AS transactions
       FROM billing.payments
       WHERE is_refunded = FALSE
         AND received_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(received_at)
       ORDER BY date ASC`,
    );
    return rows.map(r => ({
      date:         r.date,
      revenue:      Number(r.revenue),
      transactions: Number(r.transactions),
    }));
  }

  async getPatientsByDay(days = 30) {
    const { rows } = await this.db.query<{ date: string; count: string }>(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*)         AS count
       FROM patients.patients
       WHERE is_deleted = FALSE
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
    );
    return rows.map(r => ({ date: r.date, count: Number(r.count) }));
  }

  async getAppointmentsByStatus() {
    const { rows } = await this.db.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count
       FROM appointments.appointments
       WHERE is_deleted = FALSE
         AND scheduled_date >= NOW() - INTERVAL '30 days'
       GROUP BY status ORDER BY count DESC`,
    );
    return rows.map(r => ({ status: r.status, count: Number(r.count) }));
  }

  async getTopDoctors(limit = 10) {
    const { rows } = await this.db.query(
      `SELECT
         u.full_name,
         s.name AS specialty,
         COUNT(a.id) AS appointments,
         COUNT(a.id) FILTER (WHERE a.status = 'completed') AS completed,
         COALESCE(SUM(p.amount), 0) AS revenue
       FROM doctors.doctors d
       JOIN auth.users u ON u.id = d.user_id
       LEFT JOIN doctors.specialties s ON s.id = d.specialty_id
       LEFT JOIN appointments.appointments a ON a.doctor_id = d.id
         AND a.scheduled_date >= NOW() - INTERVAL '30 days'
       LEFT JOIN billing.payments p ON p.invoice_id IN (
         SELECT id FROM billing.invoices WHERE encounter_id IN (
           SELECT id FROM emr.encounters WHERE doctor_id = d.id
         )
       )
       GROUP BY d.id, u.full_name, s.name
       ORDER BY appointments DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async getLabTurnaround() {
    const { rows } = await this.db.query(
      `SELECT
         lt.name AS test_name,
         lt.category,
         COUNT(ls.id) AS total_samples,
         ROUND(AVG(
           EXTRACT(EPOCH FROM (
             MIN(lr.entered_at) - ls.collected_at
           )) / 3600
         ), 1) AS avg_hours
       FROM laboratory.lab_tests lt
       LEFT JOIN laboratory.lab_samples ls ON ls.lab_test_id = lt.id
         AND ls.status = 'resulted'
         AND ls.created_at >= NOW() - INTERVAL '30 days'
       LEFT JOIN laboratory.lab_results lr ON lr.sample_id = ls.id
       GROUP BY lt.id, lt.name, lt.category
       HAVING COUNT(ls.id) > 0
       ORDER BY avg_hours ASC`,
    );
    return rows;
  }

  async getEmergencyByESI() {
    const { rows } = await this.db.query<{ triage_level: number; count: string; avg_minutes: string }>(
      `SELECT
         triage_level,
         COUNT(*) AS count,
         ROUND(AVG(
           EXTRACT(EPOCH FROM (
             COALESCE(discharged_at, NOW()) - arrived_at
           )) / 60
         )) AS avg_minutes
       FROM emergency.emergency_visits
       WHERE DATE(arrived_at) >= CURRENT_DATE - 30
         AND triage_level IS NOT NULL
       GROUP BY triage_level
       ORDER BY triage_level ASC`,
    );
    return rows.map(r => ({
      level:      r.triage_level,
      count:      Number(r.count),
      avgMinutes: Number(r.avg_minutes),
    }));
  }

  async getDrugDispensing(limit = 10) {
    const { rows } = await this.db.query(
      `SELECT
         d.generic_name,
         d.drug_class,
         COUNT(dr.id) AS dispense_count,
         SUM(dr.quantity_dispensed) AS total_quantity
       FROM pharmacy.dispensing_records dr
       JOIN pharmacy.drugs d ON d.id = dr.drug_id
       WHERE dr.dispensed_at >= NOW() - INTERVAL '30 days'
       GROUP BY d.id, d.generic_name, d.drug_class
       ORDER BY dispense_count DESC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async getOutstandingByAge() {
    const { rows } = await this.db.query(
      `SELECT
         CASE
           WHEN issued_at >= NOW() - INTERVAL '7 days'  THEN '0-7 days'
           WHEN issued_at >= NOW() - INTERVAL '30 days' THEN '8-30 days'
           WHEN issued_at >= NOW() - INTERVAL '90 days' THEN '31-90 days'
           ELSE 'Over 90 days'
         END AS age_bucket,
         COUNT(*) AS invoice_count,
         SUM(balance_due) AS total_balance
       FROM billing.invoices
       WHERE status IN ('issued','partial')
         AND is_deleted = FALSE
       GROUP BY age_bucket
       ORDER BY MIN(issued_at) ASC`,
    );
    return rows;
  }
}
