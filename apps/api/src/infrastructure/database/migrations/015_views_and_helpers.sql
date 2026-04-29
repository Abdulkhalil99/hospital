CREATE VIEW public.v_patient_summary AS
SELECT
  p.id, p.mrn,
  p.first_name, p.last_name,
  p.first_name || ' ' || p.last_name AS full_name,
  p.date_of_birth,
  DATE_PART('year', AGE(p.date_of_birth))::INT AS age_years,
  p.gender, p.blood_type, p.phone, p.email,
  p.has_allergies, p.is_vip, p.is_active,
  p.preferred_language,
  (SELECT MAX(e.started_at) FROM emr.encounters e
   WHERE e.patient_id = p.id AND e.is_deleted = FALSE) AS last_visit_at,
  (SELECT COUNT(*) FROM emr.encounters e
   WHERE e.patient_id = p.id AND e.is_deleted = FALSE) AS total_visits,
  (SELECT COALESCE(SUM(balance_due),0) FROM billing.invoices i
   WHERE i.patient_id = p.id AND i.status IN ('issued','partial')
   AND i.is_deleted = FALSE) AS outstanding_balance,
  (SELECT ARRAY_AGG(allergen ORDER BY severity DESC)
   FROM patients.allergies a
   WHERE a.patient_id = p.id AND a.is_active = TRUE) AS allergies,
  p.created_at, p.updated_at
FROM patients.patients p
WHERE p.is_deleted = FALSE;

CREATE VIEW public.v_today_appointments AS
SELECT
  a.id AS appointment_id,
  a.scheduled_date, a.scheduled_start, a.scheduled_end,
  a.status, a.is_walk_in,
  p.id AS patient_id, p.mrn,
  p.first_name || ' ' || p.last_name AS patient_name,
  p.phone AS patient_phone, p.has_allergies,
  d.id AS doctor_id,
  u.full_name AS doctor_name,
  s.name AS specialty,
  dept.name AS department,
  qt.token_display, qt.status AS queue_status, qt.token_number,
  at2.name AS appointment_type
FROM appointments.appointments a
JOIN patients.patients           p    ON p.id    = a.patient_id
JOIN doctors.doctors             d    ON d.id    = a.doctor_id
JOIN auth.users                  u    ON u.id    = d.user_id
LEFT JOIN doctors.specialties    s    ON s.id    = d.specialty_id
LEFT JOIN doctors.departments    dept ON dept.id = d.department_id
LEFT JOIN appointments.appointment_types at2 ON at2.id = a.appointment_type_id
LEFT JOIN appointments.queue_tokens qt ON qt.appointment_id = a.id
WHERE a.scheduled_date = CURRENT_DATE AND a.is_deleted = FALSE
ORDER BY a.scheduled_start ASC, qt.token_number ASC;

CREATE VIEW public.v_live_queue AS
SELECT
  qt.id AS token_id,
  qt.token_display, qt.token_number,
  qt.status AS queue_status, qt.priority,
  qt.called_at,
  qt.created_at AS checked_in_at,
  EXTRACT(EPOCH FROM (NOW() - qt.created_at))/60 AS wait_minutes,
  p.id AS patient_id, p.mrn,
  p.first_name || ' ' || p.last_name AS patient_name,
  p.has_allergies, p.is_vip,
  d.id AS doctor_id,
  u.full_name AS doctor_name,
  a.scheduled_start,
  at2.name AS appointment_type
FROM appointments.queue_tokens qt
JOIN patients.patients           p   ON p.id  = qt.patient_id
JOIN doctors.doctors             d   ON d.id  = qt.doctor_id
JOIN auth.users                  u   ON u.id  = d.user_id
JOIN appointments.appointments   a   ON a.id  = qt.appointment_id
LEFT JOIN appointments.appointment_types at2 ON at2.id = a.appointment_type_id
WHERE qt.queue_date = CURRENT_DATE AND qt.status IN ('waiting','called')
ORDER BY qt.priority DESC, qt.token_number ASC;

CREATE VIEW public.v_emergency_board AS
SELECT
  cbo.bed_id, cbo.bed_code, cbo.bed_type, cbo.location,
  CASE WHEN cbo.visit_id IS NULL THEN 'available' ELSE 'occupied' END AS bed_status,
  cbo.visit_id,
  ev.status AS visit_status,
  ev.triage_level, ev.chief_complaint, ev.arrived_at,
  EXTRACT(EPOCH FROM (NOW() - ev.arrived_at))/60 AS minutes_in_ed,
  COALESCE(p.first_name || ' ' || p.last_name,
           (ev.unknown_patient_info->>'name')::TEXT,
           'Unknown Patient') AS patient_name,
  p.mrn, p.date_of_birth, p.has_allergies,
  ta.bp_systolic, ta.bp_diastolic, ta.pulse_bpm,
  ta.o2_saturation, ta.gcs_score, ta.pain_score
FROM emergency.current_bed_occupancy cbo
LEFT JOIN emergency.emergency_visits ev ON ev.id = cbo.visit_id
LEFT JOIN patients.patients          p  ON p.id  = cbo.patient_id
LEFT JOIN LATERAL (
  SELECT * FROM emergency.triage_assessments
  WHERE visit_id = cbo.visit_id
  ORDER BY triaged_at DESC LIMIT 1
) ta ON TRUE
ORDER BY
  CASE cbo.bed_type WHEN 'resuscitation' THEN 1 ELSE 2 END,
  CASE WHEN ev.triage_level IS NULL THEN 9 ELSE ev.triage_level END,
  ev.arrived_at ASC;

CREATE VIEW public.v_daily_revenue AS
SELECT
  DATE(py.received_at) AS payment_date,
  py.payment_method,
  COUNT(*) AS transaction_count,
  SUM(py.amount) AS total_amount,
  py.currency,
  py.received_by AS cashier_id,
  u.full_name AS cashier_name
FROM billing.payments py
JOIN auth.users u ON u.id = py.received_by
WHERE py.is_refunded = FALSE
GROUP BY DATE(py.received_at), py.payment_method, py.currency, py.received_by, u.full_name
ORDER BY payment_date DESC, total_amount DESC;

CREATE VIEW public.v_lab_worklist AS
SELECT
  ls.id AS sample_id, ls.barcode,
  ls.status AS sample_status, ls.sample_type,
  ls.collected_at, ls.received_at,
  lt.code AS test_code, lt.name AS test_name, lt.turnaround_hours,
  lo.urgency,
  EXTRACT(EPOCH FROM (NOW() - lo.created_at))/60 AS order_age_minutes,
  p.mrn, p.first_name || ' ' || p.last_name AS patient_name,
  p.date_of_birth,
  u.full_name AS ordered_by_name
FROM laboratory.lab_samples ls
JOIN emr.lab_orders      lo ON lo.id = ls.order_id
JOIN laboratory.lab_tests lt ON lt.id = ls.lab_test_id
JOIN patients.patients    p  ON p.id  = ls.patient_id
JOIN auth.users            u  ON u.id  = lo.ordered_by
WHERE ls.status IN ('received','processing')
ORDER BY
  CASE lo.urgency WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
  ls.received_at ASC;

CREATE VIEW public.v_drug_stock_alerts AS
SELECT
  di.id AS inventory_id, di.location, di.batch_number,
  di.quantity_on_hand, di.reorder_level, di.expiry_date,
  di.quantity_on_hand - di.reorder_level AS stock_gap,
  CASE
    WHEN di.quantity_on_hand = 0 THEN 'out_of_stock'
    WHEN di.quantity_on_hand <= di.reorder_level THEN 'low_stock'
    WHEN di.expiry_date IS NOT NULL AND di.expiry_date <= CURRENT_DATE + 30 THEN 'expiring_soon'
    ELSE 'ok'
  END AS alert_type,
  d.id AS drug_id, d.generic_name, d.brand_names, d.dosage_form, d.strength
FROM pharmacy.drug_inventory di
JOIN pharmacy.drugs d ON d.id = di.drug_id
WHERE di.quantity_on_hand <= di.reorder_level
   OR (di.expiry_date IS NOT NULL AND di.expiry_date <= CURRENT_DATE + 30)
ORDER BY
  CASE WHEN di.quantity_on_hand = 0 THEN 1 ELSE 2 END,
  di.expiry_date ASC NULLS LAST;
