CREATE SCHEMA IF NOT EXISTS inpatient;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE TABLE inpatient.beds (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ward TEXT NOT NULL, label TEXT NOT NULL,
 available BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(ward,label)
);
CREATE TABLE inpatient.admissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients.patients(id),
 encounter_id UUID NOT NULL UNIQUE REFERENCES emr.encounters(id), bed_id UUID NOT NULL REFERENCES inpatient.beds(id),
 status TEXT NOT NULL DEFAULT 'admitted' CHECK(status IN ('admitted','discharged')), reason TEXT NOT NULL,
 admitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), discharged_at TIMESTAMPTZ, discharge_summary TEXT, follow_up TEXT,
 created_by UUID NOT NULL REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX one_patient_admission ON inpatient.admissions(patient_id) WHERE status='admitted';
CREATE UNIQUE INDEX one_bed_occupant ON inpatient.admissions(bed_id) WHERE status='admitted';
CREATE TABLE inpatient.events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), admission_id UUID NOT NULL REFERENCES inpatient.admissions(id),
 event_type TEXT NOT NULL, detail JSONB NOT NULL, actor_id UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE inpatient.reconciliations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), admission_id UUID NOT NULL REFERENCES inpatient.admissions(id),
 phase TEXT NOT NULL CHECK(phase IN ('admission','discharge')), medications JSONB NOT NULL CHECK(jsonb_typeof(medications)='array'),
 notes TEXT NOT NULL, recorded_by UUID NOT NULL REFERENCES auth.users(id), recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE inpatient.administrations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), admission_id UUID NOT NULL REFERENCES inpatient.admissions(id),
 prescription_id UUID NOT NULL REFERENCES emr.prescriptions(id), scheduled_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('given','held','refused')), dose TEXT NOT NULL, route TEXT NOT NULL, reason TEXT,
 administered_by UUID NOT NULL REFERENCES auth.users(id), witness_id UUID REFERENCES auth.users(id),
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(prescription_id,scheduled_at)
);
CREATE TABLE operations.tasks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL CHECK(kind IN ('theatre','insurance','hr','referral')),
 patient_id UUID REFERENCES patients.patients(id), encounter_id UUID REFERENCES emr.encounters(id), assigned_to UUID REFERENCES auth.users(id),
 title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', details JSONB NOT NULL,
 created_by UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX operations_tasks_kind ON operations.tasks(kind,status,created_at DESC);
CREATE TABLE operations.task_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), task_id UUID NOT NULL REFERENCES operations.tasks(id), status TEXT NOT NULL,
 note TEXT NOT NULL, actor_id UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE operations.supplies (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, unit TEXT NOT NULL, location TEXT NOT NULL,
 quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(quantity>=0), reorder_level NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(reorder_level>=0)
);
CREATE TABLE operations.stock_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supply_id UUID NOT NULL REFERENCES operations.supplies(id),
 quantity NUMERIC(12,2) NOT NULL CHECK(quantity<>0), reason TEXT NOT NULL, reference TEXT NOT NULL,
 actor_id UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE operations.documents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients.patients(id), title TEXT NOT NULL,
 filename TEXT NOT NULL, mime_type TEXT NOT NULL, content BYTEA NOT NULL, sha256 TEXT NOT NULL,
 created_by UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE emr.imaging_orders ADD COLUMN scheduled_at TIMESTAMPTZ;
ALTER TABLE emr.imaging_orders ADD COLUMN study_uid TEXT;
CREATE TABLE patients.message_threads (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients.patients(id), subject TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE patients.messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), thread_id UUID NOT NULL REFERENCES patients.message_threads(id),
 sender_id UUID NOT NULL REFERENCES auth.users(id), body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE patients.portal_link_challenges (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id), patient_id UUID NOT NULL REFERENCES patients.patients(id),
 code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ
);
INSERT INTO auth.permissions(code,description,module) VALUES
 ('inpatient:read','View inpatient care','inpatient'),('inpatient:write','Manage inpatient care','inpatient'),
 ('inpatient:administer','Record medication administration','inpatient'),('operations:manage','Manage hospital operations','operations'),
 ('radiology:read','View imaging worklist','radiology'),('radiology:write','Manage imaging and reports','radiology'),
 ('messages:read','Read care team messages','portal'),('messages:write','Reply to care team messages','portal'),
 ('interoperability:read','Export clinical records','interoperability') ON CONFLICT(code) DO NOTHING;
INSERT INTO auth.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM auth.roles r CROSS JOIN auth.permissions p
WHERE (r.name IN ('super_admin','admin') AND p.module IN ('inpatient','operations','radiology','portal','interoperability'))
 OR (r.name='doctor' AND p.code IN ('inpatient:read','inpatient:write','radiology:read','messages:read','messages:write'))
 OR (r.name='nurse' AND p.code IN ('inpatient:read','inpatient:administer','messages:read','messages:write'))
 OR (r.name='radiologist' AND p.code IN ('radiology:read','radiology:write')) ON CONFLICT DO NOTHING;
CREATE TRIGGER admissions_audit AFTER INSERT OR UPDATE OR DELETE ON inpatient.admissions FOR EACH ROW EXECUTE FUNCTION write_audit_log();
CREATE TRIGGER administrations_audit AFTER INSERT OR UPDATE OR DELETE ON inpatient.administrations FOR EACH ROW EXECUTE FUNCTION write_audit_log();
CREATE TRIGGER operations_tasks_audit AFTER INSERT OR UPDATE OR DELETE ON operations.tasks FOR EACH ROW EXECUTE FUNCTION write_audit_log();
INSERT INTO auth.permissions(code,description,module) VALUES
 ('theatre:manage','Manage theatre cases','theatre'),('insurance:manage','Manage payer claims','insurance'),
 ('inventory:manage','Manage hospital supplies','inventory'),('hr:manage','Manage staff shifts','hr'),
 ('documents:manage','Manage patient documents','documents'),('referrals:manage','Manage referrals','referrals') ON CONFLICT DO NOTHING;
INSERT INTO auth.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM auth.roles r CROSS JOIN auth.permissions p
WHERE (r.name IN ('super_admin','admin') AND p.module IN ('theatre','insurance','inventory','hr','documents','referrals'))
 OR (r.name='doctor' AND p.code IN ('theatre:manage','referrals:manage','documents:manage'))
 OR (r.name='accountant' AND p.code='insurance:manage')
 OR (r.name='pharmacist' AND p.code='inventory:manage') ON CONFLICT DO NOTHING;
