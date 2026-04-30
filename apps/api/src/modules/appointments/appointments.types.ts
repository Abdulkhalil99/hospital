export interface CreateAppointmentInput {
  patientId:         string;
  doctorId:          string;
  appointmentTypeId: string;
  scheduledDate:     string;   // YYYY-MM-DD
  scheduledStart:    string;   // HH:MM
  notes?:            string;
  isWalkIn?:         boolean;
}

export interface AppointmentRow {
  id:                  string;
  patient_id:          string;
  doctor_id:           string;
  appointment_type_id: string;
  scheduled_date:      Date;
  scheduled_start:     string;
  scheduled_end:       string;
  status:              string;
  checked_in_at:       Date | null;
  completed_at:        Date | null;
  cancelled_at:        Date | null;
  cancellation_reason: string | null;
  is_walk_in:          boolean;
  notes:               string | null;
  created_at:          Date;
  updated_at:          Date;
  patient_name?:       string;
  patient_mrn?:        string;
  doctor_name?:        string;
  type_name?:          string;
}

export interface QueueTokenRow {
  id:              string;
  appointment_id:  string;
  patient_id:      string;
  doctor_id:       string;
  token_number:    number;
  token_display:   string;
  queue_date:      Date;
  status:          string;
  priority:        number;
  called_at:       Date | null;
  completed_at:    Date | null;
  wait_minutes:    number | null;
  created_at:      Date;
  patient_name?:   string;
  patient_mrn?:    string;
  doctor_name?:    string;
}

export type AppointmentStatus =
  | 'scheduled' | 'confirmed' | 'checked_in'
  | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export type QueueStatus =
  | 'waiting' | 'called' | 'in_room' | 'completed' | 'skipped';
