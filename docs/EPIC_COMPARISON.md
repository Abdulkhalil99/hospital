# MediCore compared with Epic hospital software (October 2026)

Epic offers a configurable suite across hospitals, clinics, specialties,
patients, payers, and community partners. There is no single public list of
"exactly every feature" in a particular Epic installation: configuration and
licensed products differ, while detailed implementation material often requires
Epic UserWeb access. This is a public-capability comparison against the code in
MediCore, a local demo. It does not claim certification or parity.

| Hospital capability | MediCore today | Main gap to close |
| --- | --- | --- |
| Registration and identity | Patient registration, MRN, contact verification, portal linking | Enterprise identity matching, merge/unmerge, cross-organization identity |
| Scheduling and access | Staff and patient booking, availability, rescheduling, check-in | Referral-linked scheduling, waitlists, visit itineraries, specialty-specific rules |
| Longitudinal chart | Encounters, notes, diagnoses, allergies, vital signs, and an active/resolved problem list | Care plans, health maintenance, structured history, reconciliation across organizations |
| Orders and clinical safety | Prescriptions, lab and imaging orders; pharmacy allergy and interaction checks at dispensing | Order-time decision support, reviewed rules, duplicate-order checks, richer terminology |
| Inpatient and nursing | Admissions, beds, transfer, medication reconciliation and administration | Care plans and pathways, flowsheets, barcode medication administration, critical-care device feeds |
| Emergency and surgery | Triage, trauma, bed board, theatre cases and checklists | Deeper emergency tracking, perioperative and anesthesia documentation, implant/device traceability |
| Pharmacy and supply | Drug catalog, dispensing, stock and hospital supplies | End-to-end order verification, preparation, inventory, recalls and external pharmacy exchange |
| Laboratory and imaging | Worklists, result validation/release, imaging orders and reports | Analyzer/PACS interfaces, structured results, specimen chain of custody, image viewing |
| Revenue cycle and payers | Invoices, payments, claims tracking and reports | Electronic eligibility, authorization, claim submission/remittance, estimates, denial management |
| Patient experience | Portal appointments, results, prescriptions, bills, messages and summary download | Proxy access, education, questionnaires, richer self-service and mobile experiences |
| Interoperability | Patient-scoped FHIR R4 collection download | Searchable FHIR API, SMART OAuth, consent, import/reconciliation, HL7/X12/DICOM interfaces |
| Population health and analytics | Operational reports and dashboards | Registries, quality measures, risk stratification, care gaps and governed analytics |
| Specialty applications | General doctor, radiology, lab and pharmacy screens | Oncology, cardiology, dialysis, dental, orthopaedic and other specialty workflows |
| Post-acute, home and community | Referrals and basic patient messages | Post-acute placement, home-care workflows, community partner access and transitions |
| Infection control and case management | No dedicated workflow | Surveillance, utilization review, placement coordination and reporting |
| Staff communication and capacity | In-app notifications, shifts and bed views | Secure team chat, device alerts, staffing forecasts and capacity optimization |
| Research and AI | No dedicated workflow | Research study operations, governed AI assistance and validation |
| Operations and assurance | Roles, audit logs, Docker and automated tests | Security/privacy program, clinical validation, disaster recovery and conformance testing |

## Implemented toward parity

The patient portal now downloads a FHIR R4 **collection bundle** containing the
patient resource, up to 100 recent active allergies, encounter diagnoses,
prescriptions, vital-sign records, and validated lab results released to the
patient portal (each measurement or lab component is an Observation).
The export resolves the patient from the authenticated portal account, excludes
deleted or voided encounters, records an audit export event, and sends a
`no-store` response. This is a portable summary, not a FHIR API or a full chart
export. It does not include notes, documents, imaging, or billing.

The clinician chart now has a longitudinal problem list with active, resolved,
and entered-in-error states. Clinicians can add and update problems; patients
see active problems in the portal, and active problems appear as FHIR Condition
resources in the summary. The database migration also corrects the blood-type
column so its existing `unknown` default fits.

## Next work, in priority order

1. Define a clinical data dictionary and reviewed terminology mapping. Add
   care plans, health-maintenance reminders, and a complete longitudinal export
   with provenance.
2. Add SMART on FHIR authorization and patient-controlled consent before
   allowing third-party apps to retrieve records. Build import/reconciliation
   and test against independent implementations.
3. Complete order-time clinical safety, barcode medication administration,
   analyzer/PACS interfaces, and governed medication rules.
4. Add electronic payer transactions and stronger scheduling, then specialty,
   infection control, case-management and population-health workflows.
5. Validate each workflow with clinicians and perform security, reliability,
   recovery, performance and interoperability conformance exercises.

Sources: [Epic interoperability specifications](https://open.epic.com/TechnicalSpecifications),
[Epic hospital and clinic software](https://www.epic.com/software/health-systems-and-clinics/),
[Epic acute and inpatient care](https://www.epic.com/software/acute-and-inpatient-care/),
[Epic access and revenue cycle](https://www.epic.com/software/access-and-revenue-cycle/),
[Epic specialty software](https://www.epic.com/software/standalone-specialties/),
[Epic interoperability](https://www.epic.com/software/interoperability/),
[Epic FHIR interfaces](https://open.epic.com/Interface/FHIR),
[Epic patient-facing app guidance](https://fhir.epic.com/Documentation?docId=patientfacingfhirapps&section=AutomaticClientDistribution),
[Epic scheduling](https://www.epic.com/software/appointment-scheduling/),
[Epic clinical assistance](https://www.epic.com/software/art/), and
[HL7 FHIR R4 Bundle](https://hl7.org/fhir/R4/bundle.html).
