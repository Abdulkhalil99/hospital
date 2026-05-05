export const EVENTS = {
  // Auth
  USER_LOGGED_IN:          'auth.user_logged_in',
  USER_LOCKED:             'auth.user_locked',

  // Patients
  PATIENT_REGISTERED:      'patient.registered',
  PATIENT_UPDATED:         'patient.updated',

  // Appointments
  APPOINTMENT_CREATED:     'appointment.created',
  APPOINTMENT_CONFIRMED:   'appointment.confirmed',
  APPOINTMENT_CANCELLED:   'appointment.cancelled',
  APPOINTMENT_CHECKED_IN:  'appointment.checked_in',
  APPOINTMENT_COMPLETED:   'appointment.completed',

  // Queue
  QUEUE_PATIENT_CALLED:    'queue.patient_called',
  QUEUE_TOKEN_COMPLETED:   'queue.token_completed',

  // EMR
  ENCOUNTER_STARTED:       'emr.encounter_started',
  ENCOUNTER_COMPLETED:     'emr.encounter_completed',
  PRESCRIPTION_CREATED:    'emr.prescription_created',
  LAB_ORDER_CREATED:       'emr.lab_order_created',

  // Laboratory
  LAB_RESULT_READY:        'lab.result_ready',
  LAB_CRITICAL_VALUE:      'lab.critical_value',

  // Pharmacy
  DRUG_DISPENSED:          'pharmacy.drug_dispensed',
  STOCK_LOW:               'pharmacy.stock_low',

  // Billing
  INVOICE_GENERATED:       'billing.invoice_generated',
  PAYMENT_RECEIVED:        'billing.payment_received',

  // Emergency
  EMERGENCY_VISIT_CREATED: 'emergency.visit_created',
  TRAUMA_ACTIVATED:        'emergency.trauma_activated',
  CRITICAL_TRIAGE:         'emergency.critical_triage',

  // Notifications
  NOTIFICATION_SENT:       'notification.sent',
  NOTIFICATION_FAILED:     'notification.failed',
} as const;

export type EventType = typeof EVENTS[keyof typeof EVENTS];
