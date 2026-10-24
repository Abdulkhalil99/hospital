# Project review — 24 October 2026

The implemented hospital workflows were reviewed for build failures, incomplete
actions, API mismatches, authorization, and local/production setup.

## Completed

- Added the missing email dependency and build tooling. Compiled API imports
  resolve without development tooling; SQL migrations accompany the build.
- API modules load explicitly, so a broken required module stops startup instead
  of silently removing its routes.
- Corrected billing validation for payments, invoice items, discounts, and
  insurance claims. Invoice IDs come from the URL.
- Payment screens include partially paid invoices, keep receipt confirmation
  visible, and guard against stale invoice selection.
- Appointment booking clears outdated patient/time selections and ignores
  stale search and availability responses.
- Doctors can start or reopen an encounter from the patient list.
- Portal linking requires identifying details and applies ownership changes
  atomically. Patient-only accounts use portal routes to access their own data;
  they cannot use staff permissions to read other patients' records.
- Real-time notification, queue, and emergency subscriptions check account
  ownership or the corresponding staff permission.
- Docker packaging includes workspace dependencies and Next standalone output.
  Production startup runs migrations first, checks authenticated Redis health,
  passes frontend build URLs, and respects the database TLS setting.
- Integration tests build a unique temporary database from migrations instead
  of cloning or dropping an existing database. CI runs build, lint, type checks,
  unit tests, and integration tests.

## Remaining feature gaps

- Push notifications still lack device-token registration and lookup.
- Radiology, inpatient wards, theatre, inventory, documents, insurance, and HR
  are placeholder modules rather than implemented workflows. They are not
  mounted as working API routes. Billing's insurance-claim submission is a
  separate existing workflow.
- Portal self-linking currently checks MRN plus phone/date of birth. Verifying
  possession through an OTP challenge remains an additional workflow to build.
- Existing lint warnings and broad use of `any` remain technical cleanup work.

## Deployment configuration

Live email/SMS delivery needs SMTP/Twilio credentials. Deployment also needs the
actual public URLs, secrets, and TLS certificates. These are operator-specific
values and are not generated or replaced by this review.

The README's existing demo/development scope still applies. Passing automated
checks does not establish readiness for clinical deployment.
