import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import {
  SampleRow, ResultRow,
  CollectSampleInput, ResultComponentInput,
} from './laboratory.types';

export class LaboratoryRepository {
  private db: Pool = getDb();

  // ── Barcode generation ────────────────────────────────────
  async generateBarcode(): Promise<string> {
    const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM laboratory.lab_samples
       WHERE DATE(created_at) = CURRENT_DATE`,
    );
    const seq = String(Number(rows[0].count) + 1).padStart(4, '0');
    return `LAB-${today}-${seq}`;
  }

  // ── Orders ────────────────────────────────────────────────
  async getOrderById(id: string) {
    const { rows } = await this.db.query(
      `SELECT lo.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              p.date_of_birth,
              p.gender,
              u.full_name AS ordered_by_name,
              lt.name AS test_name,
              lt.sample_type AS required_sample_type,
              lt.turnaround_hours
       FROM emr.lab_orders lo
       JOIN patients.patients p ON p.id = lo.patient_id
       JOIN auth.users         u ON u.id = lo.ordered_by
       LEFT JOIN laboratory.lab_tests lt ON lt.code = lo.test_code
       WHERE lo.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async getWorklist(filters: {
    status?: string; urgency?: string; date?: string;
  }) {
    const conds: string[] = ['1=1'];
    const vals: unknown[] = [];
    let i = 1;

    if (filters.status)  { conds.push(`lo.status = $${i++}`);            vals.push(filters.status); }
    if (filters.urgency) { conds.push(`lo.urgency = $${i++}`);           vals.push(filters.urgency); }
    if (filters.date)    { conds.push(`DATE(lo.created_at) = $${i++}::DATE`); vals.push(filters.date); }

    const { rows } = await this.db.query(
      `SELECT lo.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              p.date_of_birth, p.gender,
              u.full_name AS ordered_by_name,
              ls.barcode, ls.status AS sample_status,
              ls.collected_at, ls.received_at
       FROM emr.lab_orders lo
       JOIN patients.patients p   ON p.id  = lo.patient_id
       JOIN auth.users         u  ON u.id  = lo.ordered_by
       LEFT JOIN laboratory.lab_samples ls ON ls.order_id = lo.id AND ls.status != 'rejected'
       WHERE ${conds.join(' AND ')}
       ORDER BY
         CASE lo.urgency WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
         lo.created_at ASC`,
      vals,
    );
    return rows;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    await this.db.query(
      `UPDATE emr.lab_orders SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, status],
    );
  }

  // ── Samples ───────────────────────────────────────────────
  async createSample(
    orderId: string, patientId: string, labTestId: string | null,
    barcode: string, sampleType: string,
    collectedBy: string, notes: string | null,
  ): Promise<SampleRow> {
    const { rows } = await this.db.query<SampleRow>(
      `INSERT INTO laboratory.lab_samples
         (order_id, patient_id, lab_test_id, barcode, sample_type,
          status, collected_at, collected_by, notes)
       VALUES ($1,$2,$3,$4,$5,'collected',NOW(),$6,$7)
       RETURNING *`,
      [orderId, patientId, labTestId, barcode, sampleType, collectedBy, notes],
    );
    return rows[0];
  }

  async findSampleByBarcode(barcode: string): Promise<SampleRow | null> {
    const { rows } = await this.db.query<SampleRow>(
      `SELECT ls.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              lo.test_name, lo.urgency
       FROM laboratory.lab_samples ls
       JOIN patients.patients p ON p.id = ls.patient_id
       JOIN emr.lab_orders lo   ON lo.id = ls.order_id
       WHERE ls.barcode = $1`,
      [barcode],
    );
    return rows[0] ?? null;
  }

  async findSampleById(id: string): Promise<SampleRow | null> {
    const { rows } = await this.db.query<SampleRow>(
      `SELECT ls.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              lo.test_name, lo.urgency
       FROM laboratory.lab_samples ls
       JOIN patients.patients p ON p.id = ls.patient_id
       JOIN emr.lab_orders lo   ON lo.id = ls.order_id
       WHERE ls.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updateSampleStatus(
    id: string, status: string,
    extra: Record<string, unknown> = {},
  ): Promise<SampleRow | null> {
    const sets  = [`status = $2`, `updated_at = NOW()`];
    const vals: unknown[] = [id, status];
    let idx = 3;
    for (const [k, v] of Object.entries(extra)) {
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    const { rows } = await this.db.query<SampleRow>(
      `UPDATE laboratory.lab_samples SET ${sets.join(', ')}
       WHERE id = $1 RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  // ── Reference ranges ──────────────────────────────────────
  async getReferenceRange(
    labTestId: string, componentName: string,
    gender: string, ageYears: number,
  ) {
    const { rows } = await this.db.query(
      `SELECT * FROM laboratory.reference_ranges
       WHERE lab_test_id     = $1
         AND LOWER(component_name) = LOWER($2)
         AND (gender = 'all' OR gender = $3)
         AND age_min_years  <= $4
         AND age_max_years  >= $4
       ORDER BY gender DESC
       LIMIT 1`,
      [labTestId, componentName, gender, ageYears],
    );
    return rows[0] ?? null;
  }

  // ── Results ───────────────────────────────────────────────
  async insertResult(data: {
    sampleId:      string;
    orderId:       string;
    patientId:     string;
    componentName: string;
    resultValue:   string;
    resultNumeric: number | null;
    unit:          string | null;
    normalMin:     number | null;
    normalMax:     number | null;
    flag:          string | null;
    isCritical:    boolean;
    enteredBy:     string;
  }): Promise<ResultRow> {
    const { rows } = await this.db.query<ResultRow>(
      `INSERT INTO laboratory.lab_results
         (sample_id, order_id, patient_id, component_name,
          result_value, result_numeric, unit, normal_min, normal_max,
          flag, is_critical, entered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        data.sampleId, data.orderId, data.patientId,
        data.componentName, data.resultValue,
        data.resultNumeric, data.unit,
        data.normalMin, data.normalMax,
        data.flag, data.isCritical, data.enteredBy,
      ],
    );
    return rows[0];
  }

  async validateResults(resultIds: string[], validatedBy: string): Promise<void> {
    await this.db.query(
      `UPDATE laboratory.lab_results
       SET validated_by = $2, validated_at = NOW()
       WHERE id = ANY($1::uuid[]) AND validated_at IS NULL`,
      [resultIds, validatedBy],
    );
  }

  async releaseResults(resultIds: string[], releasedBy: string): Promise<void> {
    await this.db.query(
      `UPDATE laboratory.lab_results
       SET released_at = NOW(), released_by = $2
       WHERE id = ANY($1::uuid[]) AND released_at IS NULL`,
      [resultIds, releasedBy],
    );
  }

  async getResultsBySample(sampleId: string): Promise<ResultRow[]> {
    const { rows } = await this.db.query<ResultRow>(
      `SELECT lr.*,
              u1.full_name AS entered_by_name,
              u2.full_name AS validated_by_name
       FROM laboratory.lab_results lr
       JOIN auth.users u1 ON u1.id = lr.entered_by
       LEFT JOIN auth.users u2 ON u2.id = lr.validated_by
       WHERE lr.sample_id = $1
       ORDER BY lr.component_name`,
      [sampleId],
    );
    return rows;
  }

  async getResultsByOrder(orderId: string): Promise<ResultRow[]> {
    const { rows } = await this.db.query<ResultRow>(
      `SELECT lr.*,
              u1.full_name AS entered_by_name,
              u2.full_name AS validated_by_name
       FROM laboratory.lab_results lr
       JOIN auth.users u1 ON u1.id = lr.entered_by
       LEFT JOIN auth.users u2 ON u2.id = lr.validated_by
       WHERE lr.order_id = $1
       ORDER BY lr.component_name`,
      [orderId],
    );
    return rows;
  }

  async getResultsByPatient(patientId: string, released = false) {
    const { rows } = await this.db.query(
      `SELECT lr.*,
              lo.test_name, lo.urgency,
              ls.barcode,
              ls.collected_at
       FROM laboratory.lab_results lr
       JOIN emr.lab_orders    lo ON lo.id = lr.order_id
       JOIN laboratory.lab_samples ls ON ls.id = lr.sample_id
       WHERE lr.patient_id   = $1
         AND lr.validated_at IS NOT NULL
         AND ($2 = FALSE OR lr.released_at IS NOT NULL)
       ORDER BY lr.entered_at DESC`,
      [patientId, released],
    );
    return rows;
  }

  // ── Critical value alerts ─────────────────────────────────
  async getPendingCriticalAlerts() {
    const { rows } = await this.db.query(
      `SELECT cva.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              lr.component_name, lr.result_value, lr.unit, lr.flag,
              u.full_name AS doctor_name
       FROM laboratory.critical_value_alerts cva
       JOIN patients.patients   p  ON p.id  = cva.patient_id
       JOIN laboratory.lab_results lr ON lr.id = cva.result_id
       JOIN doctors.doctors     d  ON d.id  = cva.ordering_doctor_id
       JOIN auth.users           u  ON u.id  = d.user_id
       WHERE cva.acknowledged_at IS NULL
       ORDER BY cva.alert_sent_at ASC`,
    );
    return rows;
  }

  async acknowledgeCriticalAlert(alertId: string, userId: string, note?: string): Promise<void> {
    await this.db.query(
      `UPDATE laboratory.critical_value_alerts
       SET acknowledged_at   = NOW(),
           acknowledged_by   = $2,
           acknowledgment_note = $3
       WHERE id = $1`,
      [alertId, userId, note ?? null],
    );
  }

  // ── Test catalog ──────────────────────────────────────────
  async getTestCatalog() {
    const { rows } = await this.db.query(
      `SELECT lt.*,
              COUNT(rr.id) AS reference_ranges_count
       FROM laboratory.lab_tests lt
       LEFT JOIN laboratory.reference_ranges rr ON rr.lab_test_id = lt.id
       WHERE lt.is_active = TRUE
       GROUP BY lt.id
       ORDER BY lt.category, lt.name`,
    );
    return rows;
  }

  async getTestWithRanges(testId: string) {
    const { rows: test } = await this.db.query(
      `SELECT * FROM laboratory.lab_tests WHERE id = $1`,
      [testId],
    );
    const { rows: ranges } = await this.db.query(
      `SELECT * FROM laboratory.reference_ranges WHERE lab_test_id = $1 ORDER BY component_name`,
      [testId],
    );
    return { test: test[0] ?? null, ranges };
  }
}
