export type NotificationChannel = 'sms' | 'email' | 'push' | 'inapp';
export type NotificationStatus  = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface NotificationPayload {
  userId?:          string;
  recipientPhone?:  string;
  recipientEmail?:  string;
  eventType:        string;
  channelCode:      NotificationChannel;
  localeCode?:      'en' | 'fa' | 'ps';
  variables:        Record<string, string>;
  priority?:        1 | 2 | 3 | 4;   // 1 = critical, 4 = low
  referenceType?:   string;
  referenceId?:     string;
}

export interface TemplateRow {
  id:           string;
  event_type:   string;
  channel_code: string;
  locale_code:  string;
  subject:      string | null;
  body:         string;
}

export interface QueueRow {
  id:               string;
  user_id:          string | null;
  recipient_phone:  string | null;
  recipient_email:  string | null;
  event_type:       string;
  channel_code:     string;
  locale_code:      string;
  template_id:      string | null;
  variables:        Record<string, string>;
  rendered_subject: string | null;
  rendered_body:    string | null;
  status:           string;
  attempts:         number;
  max_attempts:     number;
  next_attempt_at:  Date;
  last_error:       string | null;
  priority:         number;
  reference_type:   string | null;
  reference_id:     string | null;
}

export interface DeliveryResult {
  success:          boolean;
  providerMessageId?: string;
  error?:           string;
}
