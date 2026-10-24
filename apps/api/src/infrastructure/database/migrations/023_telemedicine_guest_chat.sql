-- Invited patients may join a call without an application account.
-- Keep their session/role attribution without inventing an auth.users identity.
ALTER TABLE telemedicine.chat_messages ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE telemedicine.chat_messages
  ADD CONSTRAINT tele_chat_guest_patient_only
  CHECK (sender_id IS NOT NULL OR sender_role = 'patient');
