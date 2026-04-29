-- ============================================================
-- MIGRATION 002 — Audit schema
-- Purpose: Immutable record of every action in the system
-- Run order: SECOND — other schemas will trigger into this
-- Rule: NO UPDATE, NO DELETE ever allowed on these tables
-- ============================================================

-- ── audit_logs ───────────────────────────────────────────────
-- Every INSERT / UPDATE / DELETE on sensitive tables lands here.
-- The trigger write_audit_log() (from migration 001) populates it.
CREATE TABLE audit.audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID,                        -- who did it (null = system action)
  action       VARCHAR(10) NOT NULL,        -- INSERT | UPDATE | DELETE
  schema_name  VARCHAR(50) NOT NULL,
  table_name   VARCHAR(100) NOT NULL,
  record_id    TEXT,                        -- the PK of the changed row
  before_data  JSONB,                       -- full row snapshot before change
  after_data   JSONB,                       -- full row snapshot after change
  ip_address   VARCHAR(45),                 -- client IP from session variable
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at — this table is append-only
  -- NO is_deleted — records are NEVER removed
);

-- Index by date for time-range queries (BRIN is cheap on append-only tables)
CREATE INDEX idx_audit_logs_created    ON audit.audit_logs USING BRIN (created_at);
CREATE INDEX idx_audit_logs_user       ON audit.audit_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_table      ON audit.audit_logs (schema_name, table_name);
CREATE INDEX idx_audit_logs_record     ON audit.audit_logs (record_id);

-- ── emr_access_logs ──────────────────────────────────────────
-- Tracks every view of a patient's EMR (not just changes).
-- Required for HIPAA compliance: who looked at whose record.
CREATE TABLE audit.emr_access_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL,        -- who opened the record
  patient_id   UUID        NOT NULL,        -- whose record
  encounter_id UUID,                        -- specific encounter (if any)
  access_type  VARCHAR(20) NOT NULL DEFAULT 'view',  -- view | print | export
  ip_address   VARCHAR(45),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emr_access_patient ON audit.emr_access_logs (patient_id);
CREATE INDEX idx_emr_access_user    ON audit.emr_access_logs (user_id);
CREATE INDEX idx_emr_access_date    ON audit.emr_access_logs USING BRIN (created_at);

-- ── security_events ──────────────────────────────────────────
-- Failed logins, locked accounts, permission violations.
CREATE TABLE audit.security_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   VARCHAR(50) NOT NULL,        -- login_failed | account_locked | permission_denied
  user_id      UUID,
  username_attempt VARCHAR(100),            -- what was typed if user not found
  ip_address   VARCHAR(45),
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_events_type ON audit.security_events (event_type);
CREATE INDEX idx_security_events_date ON audit.security_events USING BRIN (created_at);