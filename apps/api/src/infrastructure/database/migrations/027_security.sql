ALTER TABLE auth.users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE auth.user_mfa (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pending_expires_at TIMESTAMPTZ,
  last_step BIGINT NOT NULL DEFAULT -1,
  recovery_hashes TEXT[] NOT NULL DEFAULT '{}',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_security_events_user ON auth.security_events(user_id, created_at DESC);

CREATE TABLE notifications.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('web','android','ios')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_push_devices_user ON notifications.push_devices(user_id);

-- Push payloads deliberately contain no clinical or identifying information.
INSERT INTO notifications.notification_templates (event_type, channel_code, locale_code, subject, body)
SELECT DISTINCT event_type, 'push', 'en', 'MediCore', 'You have a new notification. Sign in to MediCore to view it.'
FROM notifications.notification_templates
WHERE event_type NOT LIKE 'auth.%'
ON CONFLICT DO NOTHING;
