# MediCore compared with Epic (October 2026)

Epic is a mature EHR platform used across organizations. MediCore is a local
demo. The table compares capabilities visible in this repository with Epic's
published product and interoperability material; it is not a certification or
claim of feature parity.

| Area | MediCore today | Main gap to close |
| --- | --- | --- |
| Clinical chart | Encounters, SOAP notes, diagnoses, prescriptions, lab orders, allergies, and vital signs | Longitudinal problem list, care plans, standardized terminology, broader clinical safety checks |
| Patient access | Portal for appointments, results, prescriptions, bills, and messages; downloadable FHIR R4 summary | Patient-authorized app access through SMART on FHIR and a fuller longitudinal export |
| Interoperability | Downloadable, patient-scoped FHIR R4 collection bundle for recent records | Searchable FHIR API, OAuth scopes and consent, import/reconciliation, HL7 interfaces, external exchange testing |
| Scheduling | Staff and patient booking, availability, rescheduling, check-in | Referral-linked scheduling, multi-step visit itineraries, broader specialty rules |
| Hospital operations | Inpatient, emergency, theatre, radiology, pharmacy, lab, billing, and inventory workflows | Deeper workflow integration, device and external system interfaces, production-scale validation |
| Clinical decision support | Pharmacy allergy and interaction checks at dispensing | Order-time checks, maintained terminology and evidence sources, governance and monitoring |
| Deployment and assurance | Local Docker setup, role permissions, audit logs, automated tests | Formal security/privacy program, clinical validation, disaster recovery, performance and interoperability conformance testing |

## Added in this iteration

The patient portal now downloads a FHIR R4 **collection bundle** containing the
patient resource, up to 100 recent active allergies, encounter diagnoses,
prescriptions, vital-sign records, and validated lab results released to the
patient portal (each measurement or lab component is an Observation).
The export resolves the patient from the authenticated portal account, excludes
deleted or voided encounters, records an audit export event, and sends a
`no-store` response. This is a portable summary, not a FHIR API or a full chart
export. It does not include notes, documents, imaging, or billing.

## Next work, in priority order

1. Define a clinical data dictionary and terminology mapping, then add a
   complete longitudinal export with provenance and released results.
2. Add SMART on FHIR authorization and patient-controlled consent before
   allowing third-party apps to retrieve records.
3. Strengthen order-time clinical safety and medication reconciliation with
   reviewed rules, override reasons, and audit trails.
4. Validate workflows with clinicians, test data exchange against independent
   systems, and perform security, reliability, and recovery exercises.

Sources: [Epic interoperability specifications](https://open.epic.com/TechnicalSpecifications),
[Epic FHIR interfaces](https://open.epic.com/Interface/FHIR),
[Epic patient-facing app guidance](https://fhir.epic.com/Documentation?docId=patientfacingfhirapps&section=AutomaticClientDistribution),
[Epic scheduling](https://www.epic.com/software/appointment-scheduling/),
[Epic clinical assistance](https://www.epic.com/software/art/), and
[HL7 FHIR R4 Bundle](https://hl7.org/fhir/R4/bundle.html).
