import { eventBus }      from '@/shared/events/event-bus';
import { EVENTS }        from '@/shared/events/event-types';
import { BillingRepository } from './billing.repository';
import { logger }        from '@/infrastructure/logger/logger';
import { getDb }         from '@/infrastructure/database/db.client';

const repo = new BillingRepository();
const db   = getDb();

export function registerBillingHooks(): void {

  // Auto-create invoice when encounter completes
  eventBus.on(EVENTS.ENCOUNTER_COMPLETED, async (payload: unknown) => {
    const { encounterId, patientId, doctorId } = payload as {
      encounterId: string; patientId: string; doctorId: string;
    };
    try {
      // Check invoice doesn't already exist for this encounter
      const { rows } = await db.query(
        `SELECT id FROM billing.invoices
         WHERE encounter_id = $1 AND is_deleted = FALSE LIMIT 1`,
        [encounterId],
      );
      if (rows.length > 0) return;

      // Create invoice
      const invoice = await repo.createInvoice(
        { patientId, encounterId },
        'system',
      );

      // Get doctor consultation fee
      const { rows: drRows } = await db.query(
        `SELECT d.consultation_fee, d.consultation_fee_currency,
                u.full_name, at2.name AS appt_type
         FROM doctors.doctors d
         JOIN auth.users u ON u.id = d.user_id
         LEFT JOIN appointments.appointments a ON a.encounter_id_ref = $1
         LEFT JOIN appointments.appointment_types at2 ON at2.id = a.appointment_type_id
         WHERE d.id = $2 LIMIT 1`,
        [encounterId, doctorId],
      );

      const fee  = drRows[0]?.consultation_fee ?? 300;
      const name = drRows[0]?.full_name ?? 'Doctor';

      // Add consultation line item
      await repo.addItem({
        invoiceId:   invoice.id,
        description: `Consultation — ${name}`,
        quantity:    1,
        unitPrice:   fee,
      });

      logger.info('Auto-invoice created on encounter completion', {
        invoiceId:   invoice.id,
        encounterId,
        patientId,
      });
    } catch (err: unknown) {
      logger.error('Auto-invoice creation failed', {
        encounterId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Auto-add lab charge when lab order resulted
  eventBus.on(EVENTS.LAB_RESULT_READY, async (payload: unknown) => {
    const { resultIds } = payload as { resultIds: string[] };
    if (!resultIds?.length) return;
    try {
      // Get the order and its encounter's invoice
      const { rows } = await db.query(
        `SELECT lo.id AS order_id, lo.test_name, lo.patient_id,
                lt.price,
                inv.id AS invoice_id
         FROM laboratory.lab_results lr
         JOIN emr.lab_orders lo ON lo.id = lr.order_id
         LEFT JOIN laboratory.lab_tests lt ON lt.code = lo.test_code
         LEFT JOIN billing.invoices inv ON inv.encounter_id = (
           SELECT encounter_id FROM emr.lab_orders WHERE id = lo.id
         ) AND inv.is_deleted = FALSE
         WHERE lr.id = $1 LIMIT 1`,
        [resultIds[0]],
      );
      if (!rows[0]?.invoice_id) return;

      await repo.addItem({
        invoiceId:   rows[0].invoice_id,
        description: `Lab: ${rows[0].test_name}`,
        quantity:    1,
        unitPrice:   rows[0].price ?? 150,
        labOrderId:  rows[0].order_id,
      });
    } catch (err: unknown) {
      logger.error('Auto lab charge failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info('Billing event hooks registered');
}
