-- ============================================================
-- MIGRATION 001 — Foundation
-- Purpose: Extensions, all schemas, shared trigger functions
-- Run order: FIRST — everything depends on this
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
-- pgcrypto  → gen_random_uuid() for all primary keys
-- pg_trgm   → fuzzy search on patient names
-- unaccent  → search ignores accents (Ahmad = Aḥmad)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ── Schemas (one per module — isolation boundary) ─────────────
-- Why: each module owns its schema. Cross-module joins require
-- explicit schema prefix (patients.patients) making boundaries
-- visible and intentional.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS patients;
CREATE SCHEMA IF NOT EXISTS doctors;
CREATE SCHEMA IF NOT EXISTS appointments;
CREATE SCHEMA IF NOT EXISTS emr;
CREATE SCHEMA IF NOT EXISTS pharmacy;
CREATE SCHEMA IF NOT EXISTS laboratory;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS emergency;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS i18n;

-- ── Shared trigger: auto-update updated_at ────────────────────
-- Applied to every table that has updated_at.
-- Never forget to update the timestamp again.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Shared trigger: write to audit log on any change ─────────
-- Applied to every sensitive table.
-- Records: who, what table, what record, what changed, when.
CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Pull the requesting user from session variable
  -- Set this at the start of every transaction:
  --   SET LOCAL app.current_user_id = 'uuid-here';
  BEGIN
    v_user_id := current_setting('app.current_user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO audit.audit_logs (
    user_id,
    action,
    schema_name,
    table_name,
    record_id,
    before_data,
    after_data,
    ip_address
  ) VALUES (
    v_user_id,
    TG_OP,                          -- 'INSERT', 'UPDATE', 'DELETE'
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN (OLD.id)::TEXT
      ELSE (NEW.id)::TEXT
    END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    current_setting('app.client_ip', true)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;