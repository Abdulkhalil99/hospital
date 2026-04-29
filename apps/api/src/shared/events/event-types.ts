export const EVENTS = {
  PATIENT_REGISTERED:     'patient.registered',
  PATIENT_UPDATED:        'patient.updated',
  APPOINTMENT_CREATED:    'appointment.created',
  APPOINTMENT_CHECKED_IN: 'appointment.checked_in',
  APPOINTMENT_COMPLETED:  'appointment.completed',
  ENCOUNTER_STARTED:      'encounter.started',
  LAB_ORDER_CREATED:      'lab_order.created',
  LAB_RESULT_READY:       'lab_result.ready',
  LAB_CRITICAL_VALUE:     'lab_result.critical_value',
  PRESCRIPTION_CREATED:   'prescription.created',
  INVOICE_GENERATED:      'invoice.generated',
  PAYMENT_RECEIVED:       'payment.received',
  USER_LOGGED_IN:         'user.logged_in',
  USER_ACCOUNT_LOCKED:    'user.account_locked',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];