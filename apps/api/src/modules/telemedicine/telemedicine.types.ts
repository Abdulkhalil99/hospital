export interface CreateSessionInput {
  patientId:      string;
  doctorId:       string;
  appointmentId?: string;
  scheduledAt?:   string;
}

export interface SessionRow {
  id:               string;
  appointment_id:   string | null;
  patient_id:       string;
  doctor_id:        string;
  patient_token:    string;
  doctor_token:     string;
  status:           string;
  scheduled_at:     Date | null;
  started_at:       Date | null;
  ended_at:         Date | null;
  duration_seconds: number | null;
  patient_consent:  boolean;
  created_at:       Date;
  patient_name?:    string;
  patient_mrn?:     string;
  doctor_name?:     string;
}

export interface ChatMessageRow {
  id:           string;
  session_id:   string;
  sender_id:    string;
  sender_role:  string;
  message:      string;
  message_type: string;
  file_url:     string | null;
  created_at:   Date;
  sender_name?: string;
}

export interface RTCSessionDescriptionPayload {
  type?: string;
  sdp?: string | null;
}

export interface RTCIceCandidatePayload {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

// WebRTC signaling message types
export type SignalingMessageType =
  | 'offer'
  | 'answer'
  | 'ice_candidate'
  | 'ready'
  | 'end_call'
  | 'chat'
  | 'consent';

export interface SignalingMessage {
  type:         SignalingMessageType;
  sessionId:    string;
  fromRole:     'doctor' | 'patient';
  // WebRTC payloads
  sdp?:         RTCSessionDescriptionPayload;
  candidate?:   RTCIceCandidatePayload;
  // Chat payload
  message?:     string;
  messageType?: string;
  // Consent
  consent?:     boolean;
}

// Returned when joining a session
export interface JoinSessionResult {
  sessionId:   string;
  role:        'doctor' | 'patient';
  patientName: string;
  doctorName:  string;
  status:      string;
  wsToken:     string;   // JWT for WebSocket auth
}
