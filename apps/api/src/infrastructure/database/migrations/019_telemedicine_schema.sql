-- ============================================================
-- MIGRATION 019 — Telemedicine schema
-- ============================================================


CREATE SCHEMA IF NOT EXISTS telemedicine;

CREATE TABLE telemedicine.sessions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID         REFERENCES appointments.appointments(id),
  patient_id        UUID         NOT NULL REFERENCES patients.patients(id),
  doctor_id         UUID         NOT NULL REFERENCES doctors.doctors(id),
  -- Join tokens (sent in links — never JWT)
  patient_token     VARCHAR(128) NOT NULL UNIQUE,
  doctor_token      VARCHAR(128) NOT NULL UNIQUE,
  -- Status
  status            VARCHAR(20)  NOT NULL DEFAULT 'waiting'
                      CHECK (status IN ('waiting','active','ended','failed')),
  -- Timing
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  duration_seconds  INTEGER,
  -- Consent
  patient_consent   BOOLEAN      NOT NULL DEFAULT FALSE,
  recording_consent BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Base
  created_by        UUID         NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tele_sessions_appointment ON telemedicine.sessions(appointment_id);
CREATE INDEX idx_tele_sessions_patient     ON telemedicine.sessions(patient_id);
CREATE INDEX idx_tele_sessions_doctor      ON telemedicine.sessions(doctor_id);
CREATE INDEX idx_tele_sessions_status      ON telemedicine.sessions(status)
  WHERE status IN ('waiting','active');

CREATE TRIGGER tele_sessions_updated_at
  BEFORE UPDATE ON telemedicine.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Chat messages during the session
CREATE TABLE telemedicine.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES telemedicine.sessions(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES auth.users(id),
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('doctor','patient')),
  message     TEXT        NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text','file','image','prescription_note')),
  file_url    VARCHAR(500),
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tele_chat_session ON telemedicine.chat_messages(session_id, created_at);

-- WebRTC signaling log (for debugging)
CREATE TABLE telemedicine.signaling_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES telemedicine.sessions(id) ON DELETE CASCADE,
  event_type  VARCHAR(30) NOT NULL,  -- offer, answer, ice_candidate, connected, disconnected
  from_role   VARCHAR(20) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tele_signal_session ON telemedicine.signaling_events(session_id);
