-- ============================================================
-- MIGRATION 004 — Auth schema
-- Users, roles, permissions, sessions
-- ============================================================

CREATE TABLE auth.users (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  username             VARCHAR(50)  NOT NULL UNIQUE,
  email                VARCHAR(255) NOT NULL UNIQUE,
  password_hash        VARCHAR(255) NOT NULL,
  full_name            VARCHAR(200) NOT NULL,
  full_name_ar         VARCHAR(200),
  phone                VARCHAR(20),
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  is_locked            BOOLEAN      NOT NULL DEFAULT FALSE,
  locked_until         TIMESTAMPTZ,
  failed_attempts      INTEGER      NOT NULL DEFAULT 0,
  last_login_at        TIMESTAMPTZ,
  last_login_ip        VARCHAR(45),
  must_change_password BOOLEAN      NOT NULL DEFAULT FALSE,
  preferred_language   CHAR(5)      NOT NULL DEFAULT 'en'
                         REFERENCES i18n.languages(code),
  avatar_url           VARCHAR(500),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by           UUID,
  updated_by           UUID,
  is_deleted           BOOLEAN      NOT NULL DEFAULT FALSE,
  deleted_at           TIMESTAMPTZ,
  deleted_by           UUID
);

CREATE UNIQUE INDEX idx_users_email    ON auth.users(email)    WHERE is_deleted = FALSE;
CREATE UNIQUE INDEX idx_users_username ON auth.users(username) WHERE is_deleted = FALSE;
CREATE INDEX        idx_users_phone    ON auth.users(phone)    WHERE phone IS NOT NULL;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_audit
  AFTER INSERT OR UPDATE OR DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

-- ── roles ────────────────────────────────────────────────────
CREATE TABLE auth.roles (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(50)  NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description  TEXT,
  is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO auth.roles (name, display_name, description, is_system) VALUES
  ('super_admin',    'Super Administrator', 'Full system access',                    TRUE),
  ('admin',          'Administrator',       'Hospital operations manager',           TRUE),
  ('doctor',         'Doctor',              'Clinical staff, treats patients',       TRUE),
  ('nurse',          'Nurse',               'Clinical support, executes orders',     TRUE),
  ('receptionist',   'Receptionist',        'Front desk, appointments, registration',TRUE),
  ('pharmacist',     'Pharmacist',          'Dispenses medications, manages stock',  TRUE),
  ('lab_technician', 'Lab Technician',      'Processes lab samples and results',     TRUE),
  ('accountant',     'Accountant',          'Billing, invoices, financial reports',  TRUE),
  ('radiologist',    'Radiologist',         'Reads and reports imaging results',     TRUE),
  ('patient',        'Patient',             'Limited portal access to own records',  TRUE);

-- ── permissions ──────────────────────────────────────────────
CREATE TABLE auth.permissions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(100) NOT NULL UNIQUE,
  description  TEXT,
  module       VARCHAR(50)  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO auth.permissions (code, description, module) VALUES
  ('patient:create',          'Register new patients',          'patients'),
  ('patient:read',            'View patient profiles',          'patients'),
  ('patient:update',          'Edit patient information',       'patients'),
  ('patient:delete',          'Deactivate patients',            'patients'),
  ('patient:search',          'Search patient records',         'patients'),
  ('emr:read',                'View clinical records',          'emr'),
  ('emr:write',               'Create/edit encounters',         'emr'),
  ('emr:addendum',            'Add addendum after lock',        'emr'),
  ('emr:delete',              'Void encounter',                 'emr'),
  ('appointment:create',      'Book appointments',              'appointments'),
  ('appointment:read',        'View appointments',              'appointments'),
  ('appointment:cancel',      'Cancel appointments',            'appointments'),
  ('appointment:reschedule',  'Reschedule appointments',        'appointments'),
  ('appointment:checkin',     'Check in patients',              'appointments'),
  ('queue:read',              'View live queue',                'queue'),
  ('queue:call_next',         'Call next patient',              'queue'),
  ('queue:manage',            'Manage queue settings',          'queue'),
  ('pharmacy:dispense',       'Dispense medications',           'pharmacy'),
  ('pharmacy:stock_read',     'View drug inventory',            'pharmacy'),
  ('pharmacy:stock_manage',   'Adjust drug stock',              'pharmacy'),
  ('pharmacy:orders',         'Create purchase orders',         'pharmacy'),
  ('lab:order_read',          'View lab orders',                'laboratory'),
  ('lab:result_enter',        'Enter lab results',              'laboratory'),
  ('lab:result_validate',     'Validate and release results',   'laboratory'),
  ('lab:stock_manage',        'Manage lab supplies',            'laboratory'),
  ('billing:read',            'View invoices',                  'billing'),
  ('billing:invoice',         'Create invoices',                'billing'),
  ('billing:payment',         'Record payments',                'billing'),
  ('billing:discount',        'Apply discounts',                'billing'),
  ('billing:report',          'View financial reports',         'billing'),
  ('emergency:triage',        'Perform triage',                 'emergency'),
  ('emergency:bed_manage',    'Assign emergency beds',          'emergency'),
  ('emergency:read',          'View emergency dashboard',       'emergency'),
  ('user:manage',             'Create and manage users',        'users'),
  ('role:manage',             'Assign roles to users',          'users'),
  ('settings:manage',         'Change hospital settings',       'settings'),
  ('report:view',             'View standard reports',          'reports'),
  ('report:export',           'Export reports',                 'reports'),
  ('audit:read',              'View audit logs',                'audit');

-- ── role_permissions ─────────────────────────────────────────
CREATE TABLE auth.role_permissions (
  role_id       UUID NOT NULL REFERENCES auth.roles(id)       ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by    UUID,
  PRIMARY KEY (role_id, permission_id)
);

-- Assign permissions to roles using plain INSERT ... SELECT
-- Doctor
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'doctor' AND p.code IN (
  'patient:read','patient:search',
  'emr:read','emr:write','emr:addendum',
  'appointment:read','appointment:create',
  'lab:order_read','billing:read',
  'queue:read','queue:call_next',
  'emergency:read','report:view'
) ON CONFLICT DO NOTHING;

-- Nurse
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'nurse' AND p.code IN (
  'patient:read','patient:search',
  'emr:read','emr:write',
  'appointment:read','appointment:checkin',
  'lab:order_read',
  'queue:read','queue:call_next',
  'emergency:triage','emergency:bed_manage','emergency:read'
) ON CONFLICT DO NOTHING;

-- Receptionist
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'receptionist' AND p.code IN (
  'patient:create','patient:read','patient:update','patient:search',
  'appointment:create','appointment:read','appointment:cancel',
  'appointment:reschedule','appointment:checkin',
  'queue:read','queue:manage',
  'billing:read','emergency:read'
) ON CONFLICT DO NOTHING;

-- Pharmacist
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'pharmacist' AND p.code IN (
  'patient:read','patient:search',
  'pharmacy:dispense','pharmacy:stock_read','pharmacy:stock_manage','pharmacy:orders',
  'emr:read','lab:order_read','billing:read'
) ON CONFLICT DO NOTHING;

-- Lab technician
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'lab_technician' AND p.code IN (
  'patient:read','patient:search',
  'lab:order_read','lab:result_enter','lab:result_validate','lab:stock_manage',
  'emr:read'
) ON CONFLICT DO NOTHING;

-- Accountant
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'accountant' AND p.code IN (
  'patient:read','patient:search',
  'billing:read','billing:invoice','billing:payment','billing:discount','billing:report',
  'report:view','report:export'
) ON CONFLICT DO NOTHING;

-- Patient portal
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'patient' AND p.code IN (
  'appointment:create','appointment:read','appointment:cancel',
  'billing:read','emr:read'
) ON CONFLICT DO NOTHING;

-- Admin
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'admin' AND p.code IN (
  'patient:create','patient:read','patient:update','patient:search',
  'emr:read','appointment:create','appointment:read',
  'appointment:cancel','appointment:reschedule',
  'billing:read','billing:invoice','billing:payment','billing:report',
  'user:manage','role:manage','settings:manage',
  'report:view','report:export','audit:read'
) ON CONFLICT DO NOTHING;

-- Super admin gets ALL permissions
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- ── user_roles ───────────────────────────────────────────────
CREATE TABLE auth.user_roles (
  user_id      UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  role_id      UUID NOT NULL REFERENCES auth.roles(id)  ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by  UUID,
  expires_at   TIMESTAMPTZ,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON auth.user_roles(user_id);

-- ── refresh_tokens ───────────────────────────────────────────
CREATE TABLE auth.refresh_tokens (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(255) NOT NULL UNIQUE,
  device_info  JSONB,
  expires_at   TIMESTAMPTZ  NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user    ON auth.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON auth.refresh_tokens(expires_at);
