-- Longitudinal conditions are distinct from diagnoses made during one encounter.
-- The existing default 'unknown' must fit when patient registration omits blood type.
-- Both existing views select this column, so preserve their definitions while
-- widening it and then restore their read grants.
DO $$
DECLARE summary_sql TEXT; history_sql TEXT;
BEGIN
  SELECT pg_get_viewdef('public.v_patient_summary'::regclass, true) INTO summary_sql;
  SELECT pg_get_viewdef('patients.v_medical_history'::regclass, true) INTO history_sql;
  DROP VIEW public.v_patient_summary;
  DROP VIEW patients.v_medical_history;
  ALTER TABLE patients.patients ALTER COLUMN blood_type TYPE VARCHAR(7);
  EXECUTE 'CREATE VIEW public.v_patient_summary AS ' || summary_sql;
  EXECUTE 'CREATE VIEW patients.v_medical_history AS ' || history_sql;
END $$;
GRANT SELECT ON public.v_patient_summary, patients.v_medical_history TO medicore_app;

CREATE TABLE patients.problem_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients.patients(id),
  icd10_code VARCHAR(20) NOT NULL,
  display VARCHAR(300) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'entered_in_error')),
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (patient_id, icd10_code)
);
CREATE INDEX idx_problem_list_active ON patients.problem_list(patient_id, recorded_at DESC)
  WHERE status = 'active';
CREATE TRIGGER problem_list_audit AFTER INSERT OR UPDATE OR DELETE ON patients.problem_list
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();
