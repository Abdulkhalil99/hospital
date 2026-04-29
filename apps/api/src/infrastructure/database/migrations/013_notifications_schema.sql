CREATE TABLE notifications.channels (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(20) NOT NULL UNIQUE,
  name       VARCHAR(50) NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE
);
INSERT INTO notifications.channels (code, name) VALUES
  ('sms',   'SMS'),
  ('email', 'Email'),
  ('push',  'Push Notification'),
  ('inapp', 'In-App Notification');

CREATE TABLE notifications.notification_templates (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   VARCHAR(100) NOT NULL,
  channel_code VARCHAR(20)  NOT NULL REFERENCES notifications.channels(code),
  locale_code  CHAR(5)      NOT NULL REFERENCES i18n.languages(code),
  subject      VARCHAR(300),
  body         TEXT         NOT NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (event_type, channel_code, locale_code)
);
CREATE INDEX idx_notif_templates_event ON notifications.notification_templates(event_type);

INSERT INTO notifications.notification_templates
  (event_type, channel_code, locale_code, subject, body) VALUES
('appointment.confirmed','sms','en',NULL,
 'MediCore: Appointment with Dr. {{doctor_name}} confirmed for {{date}} at {{time}}. MRN: {{mrn}}'),
('appointment.confirmed','email','en',
 'Appointment Confirmed - {{date}} at {{time}}',
 'Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} on {{date}} at {{time}} is confirmed. MRN: {{mrn}}'),
('appointment.reminder_24h','sms','en',NULL,
 'Reminder: Appointment with Dr. {{doctor_name}} tomorrow at {{time}}. Reply CANCEL to cancel.'),
('queue.patient_called','sms','en',NULL,
 'MediCore: It is your turn. Please proceed to Room {{room}}. Token: {{token}}'),
('lab_result.ready','inapp','en',NULL,
 'Lab results for {{test_name}} are ready for patient {{patient_name}} (MRN: {{mrn}})'),
('lab_result.critical','inapp','en',NULL,
 'CRITICAL: {{test_name}} result for {{patient_name}} - {{value}} {{unit}}. Immediate review required.'),
('lab_result.critical','sms','en',NULL,
 'CRITICAL LAB: {{patient_name}} MRN {{mrn}} - {{test_name}}: {{value}}{{unit}}. Review immediately.'),
('payment.received','sms','en',NULL,
 'MediCore: Payment of {{currency}} {{amount}} received. Receipt: {{receipt_number}}. Balance: {{balance}}'),
('emergency.trauma_activation','inapp','en',NULL,
 'TRAUMA ALERT Level {{level}}: {{mechanism}}. Bay {{location}}. All trauma team respond immediately.'),
('auth.password_reset','email','en',
 'Password Reset Request',
 'Dear {{full_name}}, click this link to reset your password (expires in 1 hour): {{reset_link}}'),
('auth.welcome','email','en',
 'Welcome to MediCore',
 'Dear {{full_name}}, your account has been created. Username: {{username}} Role: {{role}} Login: {{login_url}}. Change your password immediately.');

CREATE TABLE notifications.notification_queue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users(id),
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  event_type      VARCHAR(100) NOT NULL,
  channel_code    VARCHAR(20)  NOT NULL REFERENCES notifications.channels(code),
  locale_code     CHAR(5)      NOT NULL DEFAULT 'en' REFERENCES i18n.languages(code),
  template_id     UUID         REFERENCES notifications.notification_templates(id),
  variables       JSONB        NOT NULL DEFAULT '{}',
  rendered_subject VARCHAR(300),
  rendered_body   TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  attempts        INTEGER      NOT NULL DEFAULT 0,
  max_attempts    INTEGER      NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_error      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  priority        SMALLINT     NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
  reference_type  VARCHAR(50),
  reference_id    UUID
);
CREATE INDEX idx_notif_queue_status   ON notifications.notification_queue(status, next_attempt_at)
  WHERE status IN ('pending','failed');
CREATE INDEX idx_notif_queue_user     ON notifications.notification_queue(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_notif_queue_priority ON notifications.notification_queue(priority, created_at)
  WHERE status = 'pending';

CREATE TABLE notifications.notification_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id            UUID        REFERENCES notifications.notification_queue(id),
  user_id             UUID        REFERENCES auth.users(id),
  recipient_phone     VARCHAR(20),
  recipient_email     VARCHAR(255),
  event_type          VARCHAR(100) NOT NULL,
  channel_code        VARCHAR(20)  NOT NULL,
  locale_code         CHAR(5)      NOT NULL DEFAULT 'en',
  subject             VARCHAR(300),
  body                TEXT,
  status              VARCHAR(20)  NOT NULL,
  provider_message_id VARCHAR(200),
  error_message       TEXT,
  sent_at             TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_log_user  ON notifications.notification_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_notif_log_date  ON notifications.notification_log USING BRIN (created_at);
CREATE INDEX idx_notif_log_unread ON notifications.notification_log(user_id, channel_code, read_at)
  WHERE channel_code = 'inapp' AND read_at IS NULL AND user_id IS NOT NULL;

CREATE TABLE notifications.user_preferences (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_category VARCHAR(50) NOT NULL,
  channel_code   VARCHAR(20) NOT NULL REFERENCES notifications.channels(code),
  is_enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_category, channel_code)
);
CREATE INDEX idx_user_notif_prefs ON notifications.user_preferences(user_id);

CREATE OR REPLACE FUNCTION create_default_notification_preferences(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications.user_preferences (user_id, event_category, channel_code, is_enabled)
  VALUES
    (p_user_id,'appointments','sms',TRUE),
    (p_user_id,'appointments','email',TRUE),
    (p_user_id,'appointments','inapp',TRUE),
    (p_user_id,'lab_results','inapp',TRUE),
    (p_user_id,'lab_results','email',TRUE),
    (p_user_id,'billing','sms',TRUE),
    (p_user_id,'billing','inapp',TRUE),
    (p_user_id,'system','inapp',TRUE),
    (p_user_id,'system','email',TRUE)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
