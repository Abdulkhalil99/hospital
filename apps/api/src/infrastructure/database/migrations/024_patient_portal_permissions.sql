-- Patient self-service routes authorize ownership through portal_user_id.
-- Staff permissions would otherwise expose other patients' clinical/billing
-- records and allow booking or cancelling appointments for arbitrary patients.
DELETE FROM auth.role_permissions
WHERE role_id IN (SELECT id FROM auth.roles WHERE name = 'patient');
