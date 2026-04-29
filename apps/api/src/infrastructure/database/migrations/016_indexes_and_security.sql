CREATE INDEX IF NOT EXISTS idx_appt_doctor_date_status
  ON appointments.appointments(doctor_id, scheduled_date, status)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_appt_patient_future
  ON appointments.appointments(patient_id, scheduled_date)
  WHERE status IN ('scheduled','confirmed') AND is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_encounters_patient_date
  ON emr.encounters(patient_id, started_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_encounters_doctor_inprogress
  ON emr.encounters(doctor_id, status)
  WHERE status = 'in_progress' AND is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_prescriptions_pending
  ON emr.prescriptions(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_lab_orders_urgency_status
  ON emr.lab_orders(urgency, status)
  WHERE status IN ('ordered','sample_collected');

CREATE INDEX IF NOT EXISTS idx_invoices_unpaid
  ON billing.invoices(patient_id, status, due_date)
  WHERE status IN ('issued','partial') AND is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_audit_record_lookup
  ON audit.audit_logs(table_name, record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_live
  ON appointments.queue_tokens(doctor_id, queue_date, status, priority, token_number)
  WHERE status IN ('waiting','called');

CREATE INDEX IF NOT EXISTS idx_emv_active
  ON emergency.emergency_visits(status, triage_level, arrived_at)
  WHERE status NOT IN ('discharged','transferred','deceased','left_without_seen');

CREATE INDEX IF NOT EXISTS idx_drugs_name_trgm
  ON pharmacy.drugs USING gin(generic_name gin_trgm_ops)
  WHERE is_active = TRUE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'medicore_app') THEN
    CREATE ROLE medicore_app LOGIN PASSWORD 'change_in_production';
  END IF;
END $$;

GRANT USAGE ON SCHEMA
  auth, patients, doctors, appointments, emr,
  pharmacy, laboratory, billing, emergency,
  notifications, audit, i18n, settings, public
  TO medicore_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
  auth, patients, doctors, appointments, emr,
  pharmacy, laboratory, billing, emergency,
  notifications, i18n, settings
  TO medicore_app;

GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO medicore_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO medicore_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA billing, settings TO medicore_app;

CREATE OR REPLACE FUNCTION public.db_health_check()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'status',    'ok',
    'timestamp', NOW(),
    'schemas',   (SELECT COUNT(*) FROM information_schema.schemata
                  WHERE schema_name IN ('auth','patients','emr','billing'))
  );
END;
$$ LANGUAGE plpgsql;
