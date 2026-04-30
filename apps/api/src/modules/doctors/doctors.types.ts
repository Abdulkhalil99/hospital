export interface CreateDoctorInput {
  userId:           string;
  licenseNumber:    string;
  specialtyId?:     string;
  departmentId?:    string;
  title?:           string;
  bio?:             string;
  consultationFee?: number;
  licenseExpiresAt?: string;
}

export interface UpdateDoctorInput extends Partial<Omit<CreateDoctorInput, 'userId'>> {
  isAvailable?: boolean;
}

export interface DoctorRow {
  id:                  string;
  user_id:             string;
  license_number:      string;
  specialty_id:        string | null;
  department_id:       string | null;
  title:               string;
  bio:                 string | null;
  consultation_fee:    number;
  consultation_fee_currency: string;
  license_expires_at:  Date | null;
  is_available:        boolean;
  is_active:           boolean;
  created_at:          Date;
  updated_at:          Date;
  full_name?:          string;
  email?:              string;
  specialty_name?:     string;
  department_name?:    string;
}

export interface ScheduleInput {
  dayOfWeek:      number;   // 0 = Sunday … 6 = Saturday
  startTime:      string;   // HH:MM
  endTime:        string;   // HH:MM
  slotDuration:   number;   // minutes
  maxPatients:    number;
  location?:      string;
  effectiveFrom?: string;   // YYYY-MM-DD
  effectiveUntil?: string;
}

export interface LeaveInput {
  leaveType:  'annual' | 'sick' | 'conference' | 'emergency' | 'other';
  startDate:  string;
  endDate:    string;
  reason?:    string;
}

export interface TimeSlot {
  startTime:   string;   // HH:MM
  endTime:     string;
  available:   boolean;
  bookedCount: number;
  maxPatients: number;
}

export interface AvailabilityResult {
  date:       string;
  doctorId:   string;
  isWorkDay:  boolean;
  isOnLeave:  boolean;
  isHoliday:  boolean;
  slots:      TimeSlot[];
  totalSlots: number;
  freeSlots:  number;
}
