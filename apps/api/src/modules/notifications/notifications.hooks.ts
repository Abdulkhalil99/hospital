import { eventBus }              from '@/shared/events/event-bus';
import { EVENTS }                from '@/shared/events/event-types';
import { NotificationsService }  from './notifications.service';
import { logger }                from '@/infrastructure/logger/logger';
import { getDb }                 from '@/infrastructure/database/db.client';

const svc = new NotificationsService();
const db  = getDb();

// Helper — load patient contact info
async function getPatientContact(patientId: string) {
  const { rows } = await db.query(
    `SELECT p.first_name, p.last_name, p.phone, p.email,
            p.preferred_language AS locale,
            au.id AS portal_user_id
     FROM patients.patients p
     LEFT JOIN auth.users au ON au.id = p.portal_user_id
     WHERE p.id = $1`,
    [patientId],
  );
  return rows[0] ?? null;
}

// Helper — load doctor user id
async function getDoctorUserId(doctorId: string): Promise<string | null> {
  const { rows } = await db.query(
    `SELECT user_id FROM doctors.doctors WHERE id = $1`,
    [doctorId],
  );
  return rows[0]?.user_id ?? null;
}

export function registerNotificationHooks(): void {

  // ── Appointment confirmed ─────────────────────────────────
  eventBus.on(EVENTS.APPOINTMENT_CREATED, async (payload: unknown) => {
    const { appointmentId, patientId, doctorId, date, time } = payload as Record<string, string>;
    try {
      const patient = await getPatientContact(patientId);
      if (!patient) return;

      // Get doctor name
      const { rows } = await db.query(
        `SELECT u.full_name FROM doctors.doctors d JOIN auth.users u ON u.id = d.user_id WHERE d.id = $1`,
        [doctorId],
      );
      const doctorName = rows[0]?.full_name ?? 'Your doctor';

      const variables = {
        patient_name: `${patient.first_name} ${patient.last_name}`,
        doctor_name:  doctorName,
        date,
        time,
        mrn:          patient.phone,  // used as reference
      };

      // SMS to patient's phone
      if (patient.phone) {
        await svc.sendDirect({
          recipientPhone: patient.phone,
          eventType:      'appointment.confirmed',
          channelCode:    'sms',
          localeCode:     patient.locale ?? 'fa',
          variables,
          priority:       3,
          referenceType:  'appointment',
          referenceId:    appointmentId,
        });
      }

      // In-app to portal user if they have an account
      if (patient.portal_user_id) {
        await svc.sendToUser(patient.portal_user_id, 'appointment.confirmed', variables, {
          priority: 3, channels: ['inapp'],
          referenceType: 'appointment', referenceId: appointmentId,
        });
      }
    } catch (err) {
      logger.error('Appointment notification failed', { appointmentId, error: String(err) });
    }
  });

  // ── Patient checked in — queue notification ───────────────
  eventBus.on(EVENTS.APPOINTMENT_CHECKED_IN, async (payload: unknown) => {
    const { patientId, tokenDisplay, doctorId } = payload as Record<string, string>;
    try {
      const patient = await getPatientContact(patientId);
      if (!patient?.phone) return;

      await svc.sendDirect({
        recipientPhone: patient.phone,
        eventType:      'queue.patient_called',
        channelCode:    'sms',
        localeCode:     patient.locale ?? 'fa',
        variables:      { token: tokenDisplay, room: 'Waiting area' },
        priority:       2,
      });
    } catch (err) {
      logger.error('Check-in notification failed', { error: String(err) });
    }
  });

  // ── Lab result ready (notify ordering doctor) ─────────────
  eventBus.on(EVENTS.LAB_RESULT_READY, async (payload: unknown) => {
    const { resultIds } = payload as { resultIds: string[] };
    if (!resultIds?.length) return;
    try {
      // Get order info from first result
      const { rows } = await db.query(
        `SELECT lo.ordered_by, lo.test_name, lo.patient_id,
                p.first_name || ' ' || p.last_name AS patient_name,
                p.mrn
         FROM laboratory.lab_results lr
         JOIN emr.lab_orders lo ON lo.id = lr.order_id
         JOIN patients.patients p ON p.id = lo.patient_id
         WHERE lr.id = $1 LIMIT 1`,
        [resultIds[0]],
      );
      if (!rows[0]) return;

      await svc.sendToUser(rows[0].ordered_by, 'lab_result.ready', {
        test_name:    rows[0].test_name,
        patient_name: rows[0].patient_name,
        mrn:          rows[0].mrn,
      }, { priority: 2, channels: ['inapp'] });
    } catch (err) {
      logger.error('Lab result notification failed', { error: String(err) });
    }
  });

  // ── Critical lab value — ESC 1 priority ──────────────────
  eventBus.on(EVENTS.LAB_CRITICAL_VALUE, async (payload: unknown) => {
    const { orderId, patientId, component, value } = payload as Record<string, string>;
    try {
      const { rows } = await db.query(
        `SELECT lo.ordered_by,
                p.first_name || ' ' || p.last_name AS patient_name,
                p.mrn, lo.test_name
         FROM emr.lab_orders lo
         JOIN patients.patients p ON p.id = lo.patient_id
         WHERE lo.id = $1`,
        [orderId],
      );
      if (!rows[0]) return;

      const variables = {
        patient_name: rows[0].patient_name,
        mrn:          rows[0].mrn,
        test_name:    rows[0].test_name,
        component_name: component,
        value,
        unit:         '',
      };

      // Send on ALL channels simultaneously — critical priority
      await svc.sendToUser(rows[0].ordered_by, 'lab_result.critical', variables, {
        priority:      1,
        channels:      ['inapp', 'sms'],
        referenceType: 'lab_order',
        referenceId:   orderId,
      });
    } catch (err) {
      logger.error('Critical value notification failed', { orderId, error: String(err) });
    }
  });

  // ── Payment received — send receipt SMS ──────────────────
  eventBus.on(EVENTS.PAYMENT_RECEIVED, async (payload: unknown) => {
    const { patientId, amount, receiptNumber } = payload as Record<string, string>;
    try {
      const patient = await getPatientContact(patientId);
      if (!patient?.phone) return;

      await svc.sendDirect({
        recipientPhone: patient.phone,
        eventType:      'payment.received',
        channelCode:    'sms',
        localeCode:     patient.locale ?? 'fa',
        variables:      {
          currency:       'AFN',
          amount:         String(amount),
          receipt_number: receiptNumber,
          balance:        '0',
        },
        priority: 3,
      });
    } catch (err) {
      logger.error('Payment notification failed', { error: String(err) });
    }
  });

  // ── Patient registered — welcome SMS ─────────────────────
  eventBus.on(EVENTS.PATIENT_REGISTERED, async (payload: unknown) => {
    const { patientId, mrn } = payload as Record<string, string>;
    try {
      const patient = await getPatientContact(patientId);
      if (!patient?.phone) return;

      await svc.sendDirect({
        recipientPhone: patient.phone,
        eventType:      'appointment.confirmed',    // reuse confirmed template
        channelCode:    'sms',
        localeCode:     patient.locale ?? 'fa',
        variables:      {
          patient_name: `${patient.first_name} ${patient.last_name}`,
          doctor_name:  'MediCore Hospital',
          date:         new Date().toLocaleDateString(),
          time:         '',
          mrn,
        },
        priority: 4,
      });
    } catch (err) {
      logger.error('Welcome notification failed', { patientId, error: String(err) });
    }
  });

  logger.info('Notification event hooks registered');
}
