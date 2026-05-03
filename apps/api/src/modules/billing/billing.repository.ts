import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import {
  CreateInvoiceInput, AddInvoiceItemInput,
  RecordPaymentInput, InvoiceRow,
} from './billing.types';

export class BillingRepository {
  private db: Pool = getDb();

  // ── Invoices ──────────────────────────────────────────────
  async createInvoice(
    data: CreateInvoiceInput, createdBy: string,
  ): Promise<InvoiceRow> {
    const { rows } = await this.db.query<InvoiceRow>(
      `INSERT INTO billing.invoices
         (patient_id, encounter_id, notes, created_by)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [data.patientId, data.encounterId ?? null, data.notes ?? null, createdBy],
    );
    return rows[0];
  }

  async findInvoiceById(id: string): Promise<InvoiceRow | null> {
    const { rows } = await this.db.query<InvoiceRow>(
      `SELECT inv.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn
       FROM billing.invoices inv
       JOIN patients.patients p ON p.id = inv.patient_id
       WHERE inv.id = $1 AND inv.is_deleted = FALSE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async listInvoices(filters: {
    patientId?: string; status?: string;
    from?: string; to?: string;
    limit: number; offset: number;
  }) {
    const conds: string[] = ['inv.is_deleted = FALSE'];
    const vals:  unknown[] = [];
    let   i = 1;

    if (filters.patientId) { conds.push(`inv.patient_id = $${i++}`);             vals.push(filters.patientId); }
    if (filters.status)    { conds.push(`inv.status = $${i++}`);                  vals.push(filters.status); }
    if (filters.from)      { conds.push(`inv.issued_at >= $${i++}::DATE`);         vals.push(filters.from); }
    if (filters.to)        { conds.push(`inv.issued_at <= $${i++}::DATE + 1`);     vals.push(filters.to); }

    const where = conds.join(' AND ');
    const { rows } = await this.db.query<InvoiceRow>(
      `SELECT inv.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn
       FROM billing.invoices inv
       JOIN patients.patients p ON p.id = inv.patient_id
       WHERE ${where}
       ORDER BY inv.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, filters.limit, filters.offset],
    );
    const { rows: cr } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM billing.invoices inv WHERE ${where}`,
      vals,
    );
    return { rows, total: Number(cr[0].count) };
  }

  async updateInvoiceStatus(
    id: string, status: string,
    extra: Record<string, unknown> = {},
  ): Promise<InvoiceRow | null> {
    const sets  = [`status = $2`, `updated_at = NOW()`];
    const vals: unknown[] = [id, status];
    let   idx = 3;
    for (const [k, v] of Object.entries(extra)) {
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    const { rows } = await this.db.query<InvoiceRow>(
      `UPDATE billing.invoices SET ${sets.join(', ')}
       WHERE id = $1 AND is_deleted = FALSE RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  // ── Invoice items ─────────────────────────────────────────
  async addItem(data: AddInvoiceItemInput) {
    const { rows } = await this.db.query(
      `INSERT INTO billing.invoice_items
         (invoice_id, description, description_fa, quantity,
          unit_price, discount_percent, charge_type_id,
          encounter_id, lab_order_id, dispensing_id, imaging_order_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.invoiceId,
        data.description,
        data.descriptionFa   ?? null,
        data.quantity,
        data.unitPrice,
        data.discountPercent ?? 0,
        data.chargeTypeId    ?? null,
        data.encounterId     ?? null,
        data.labOrderId      ?? null,
        data.dispensingId    ?? null,
        data.imagingOrderId  ?? null,
      ],
    );
    return rows[0];
  }

  async getItems(invoiceId: string) {
    const { rows } = await this.db.query(
      `SELECT ii.*, ct.name AS charge_type_name
       FROM billing.invoice_items ii
       LEFT JOIN billing.charge_types ct ON ct.id = ii.charge_type_id
       WHERE ii.invoice_id = $1
       ORDER BY ii.created_at ASC`,
      [invoiceId],
    );
    return rows;
  }

  async removeItem(itemId: string, invoiceId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `DELETE FROM billing.invoice_items WHERE id = $1 AND invoice_id = $2`,
      [itemId, invoiceId],
    );
    return (rowCount ?? 0) > 0;
  }

  // ── Payments ──────────────────────────────────────────────
  async recordPayment(data: RecordPaymentInput, receivedBy: string) {
    const { rows } = await this.db.query(
      `INSERT INTO billing.payments
         (invoice_id, patient_id, amount, payment_method,
          reference_number, received_by, notes)
       SELECT $1, patient_id, $2, $3, $4, $5, $6
       FROM billing.invoices WHERE id = $1
       RETURNING *`,
      [
        data.invoiceId, data.amount,
        data.paymentMethod,
        data.referenceNumber ?? null,
        receivedBy,
        data.notes           ?? null,
      ],
    );
    return rows[0];
  }

  async getPayments(invoiceId: string) {
    const { rows } = await this.db.query(
      `SELECT py.*,
              u.full_name AS received_by_name
       FROM billing.payments py
       JOIN auth.users u ON u.id = py.received_by
       WHERE py.invoice_id = $1
       ORDER BY py.received_at ASC`,
      [invoiceId],
    );
    return rows;
  }

  async generateReceipt(paymentId: string, invoiceId: string, generatedBy: string) {
    const { rows } = await this.db.query(
      `INSERT INTO billing.receipts
         (payment_id, invoice_id, patient_id, amount, generated_by)
       SELECT $1, $2, patient_id, amount, $3
       FROM billing.payments WHERE id = $1
       RETURNING *`,
      [paymentId, invoiceId, generatedBy],
    );
    return rows[0];
  }

  // ── Discounts ─────────────────────────────────────────────
  async requestDiscount(
    data: {
      invoiceId:    string;
      discountType: string;
      amount?:      number;
      percentage?:  number;
      reason:       string;
      requestedBy:  string;
    },
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO billing.discounts
         (invoice_id, discount_type, amount, percentage, reason, requested_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')
       RETURNING *`,
      [
        data.invoiceId, data.discountType,
        data.amount     ?? null,
        data.percentage ?? null,
        data.reason, data.requestedBy,
      ],
    );
    return rows[0];
  }

  async approveDiscount(discountId: string, approvedBy: string): Promise<void> {
    // Get discount details
    const { rows } = await this.db.query(
      `UPDATE billing.discounts
       SET status = 'approved', approved_by = $2, approved_at = NOW()
       WHERE id = $1 RETURNING *`,
      [discountId, approvedBy],
    );
    if (!rows[0]) return;

    const d = rows[0];

    // Apply discount to invoice
    if (d.discount_type === 'full_waiver') {
      await this.db.query(
        `UPDATE billing.invoices
         SET discount_amount = total_amount, updated_at = NOW()
         WHERE id = $1`,
        [d.invoice_id],
      );
    } else if (d.discount_type === 'percentage' && d.percentage) {
      await this.db.query(
        `UPDATE billing.invoices
         SET discount_amount = ROUND(total_amount * $2 / 100, 2), updated_at = NOW()
         WHERE id = $1`,
        [d.invoice_id, d.percentage],
      );
    } else if (d.discount_type === 'fixed' && d.amount) {
      await this.db.query(
        `UPDATE billing.invoices
         SET discount_amount = $2, updated_at = NOW()
         WHERE id = $1`,
        [d.invoice_id, d.amount],
      );
    }
  }

  async getPendingDiscounts() {
    const { rows } = await this.db.query(
      `SELECT dc.*,
              inv.invoice_number, inv.total_amount,
              p.first_name || ' ' || p.last_name AS patient_name,
              u.full_name AS requested_by_name
       FROM billing.discounts dc
       JOIN billing.invoices  inv ON inv.id = dc.invoice_id
       JOIN patients.patients p   ON p.id  = inv.patient_id
       JOIN auth.users         u   ON u.id  = dc.requested_by
       WHERE dc.status = 'pending'
       ORDER BY dc.created_at ASC`,
    );
    return rows;
  }

  // ── Insurance claims ──────────────────────────────────────
  async createInsuranceClaim(
    data: {
      invoiceId:        string;
      insuranceCompany: string;
      policyNumber:     string;
      claimAmount:      number;
      notes?:           string;
      createdBy:        string;
    },
  ) {
    // Store claim in invoice insurance fields
    const { rows } = await this.db.query(
      `UPDATE billing.invoices
       SET insurance_coverage_amount = $2,
           notes = COALESCE(notes || E'\n', '') || $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        data.invoiceId,
        data.claimAmount,
        `Insurance claim: ${data.insuranceCompany} policy ${data.policyNumber}` +
        (data.notes ? ` — ${data.notes}` : ''),
      ],
    );
    return rows[0];
  }

  // ── Charge types ──────────────────────────────────────────
  async getChargeTypes() {
    const { rows } = await this.db.query(
      `SELECT * FROM billing.charge_types WHERE is_active = TRUE ORDER BY category, name`,
    );
    return rows;
  }

  // ── Reports ───────────────────────────────────────────────
  async getDailyRevenue(date?: string) {
    const target = date ?? new Date().toISOString().split('T')[0];
    const { rows } = await this.db.query(
      `SELECT * FROM public.v_daily_revenue
       WHERE payment_date = $1::DATE`,
      [target],
    );
    return rows;
  }

  async getRevenueByPeriod(from: string, to: string) {
    const { rows } = await this.db.query(
      `SELECT
         DATE(py.received_at)      AS date,
         COUNT(*)                  AS transactions,
         SUM(py.amount)            AS revenue,
         py.payment_method,
         py.currency
       FROM billing.payments py
       WHERE py.is_refunded = FALSE
         AND DATE(py.received_at) BETWEEN $1::DATE AND $2::DATE
       GROUP BY DATE(py.received_at), py.payment_method, py.currency
       ORDER BY date DESC`,
      [from, to],
    );
    return rows;
  }

  async getOutstandingBalances() {
    const { rows } = await this.db.query(
      `SELECT inv.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              p.phone AS patient_phone
       FROM billing.invoices inv
       JOIN patients.patients p ON p.id = inv.patient_id
       WHERE inv.status IN ('issued','partial')
         AND inv.is_deleted = FALSE
       ORDER BY inv.balance_due DESC`,
    );
    return rows;
  }

  async getCashierSummary(date?: string) {
    const target = date ?? new Date().toISOString().split('T')[0];
    const { rows } = await this.db.query(
      `SELECT
         u.full_name                           AS cashier_name,
         COUNT(py.id)                          AS transaction_count,
         SUM(py.amount)                        AS total_collected,
         SUM(py.amount) FILTER (WHERE py.payment_method = 'cash')  AS cash_total,
         SUM(py.amount) FILTER (WHERE py.payment_method = 'card')  AS card_total,
         SUM(py.amount) FILTER (WHERE py.payment_method = 'insurance') AS insurance_total,
         py.currency
       FROM billing.payments py
       JOIN auth.users u ON u.id = py.received_by
       WHERE DATE(py.received_at) = $1::DATE
         AND py.is_refunded = FALSE
       GROUP BY u.full_name, py.currency
       ORDER BY total_collected DESC`,
      [target],
    );
    return rows;
  }
}
