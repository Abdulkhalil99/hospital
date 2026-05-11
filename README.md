# MediCore

MediCore is a full-stack hospital management system monorepo built with `Next.js`, `Express`, `PostgreSQL`, and `Redis`.

It includes role-based dashboards for hospital operations such as registration, appointments, EMR workflows, laboratory, pharmacy, billing, emergency/triage, reporting, and a patient portal.

> Important
> This repository is under active development and is intended for demo, learning, and portfolio use.
> It is not ready for real clinical deployment without additional security, compliance, testing, and operational hardening.

## Highlights

- Multi-role dashboards for `admin`, `doctor`, `nurse`, `receptionist`, `pharmacist`, `lab technician`, `accountant`, and `patient`
- Patient registration, search, OTP verification, check-in, and queue flow
- Doctor workflows for appointments, EMR, prescriptions, and lab orders
- Pharmacy inventory, dispensing, and low-stock alerts
- Laboratory worklists, result entry, and critical result tracking
- Emergency triage, trauma tracking, and bed-board management
- Billing, payments, outstanding balances, and reports
- Patient portal for appointments, prescriptions, lab results, and bills
- Internationalized UI with `English`, `Dari/Farsi`, and `Pashto`
- Real-time features via `Socket.IO`

## Tech Stack

- Frontend: `Next.js 14`, `React 18`, `TypeScript`, `Tailwind CSS`, `next-intl`, `Recharts`, `Zustand`
- Backend: `Express`, `TypeScript`, `Zod`, `JWT`, `Socket.IO`, `BullMQ`, `Winston`
- Data & Infra: `PostgreSQL`, `Redis`, `Docker Compose`, `Nginx`, `MailHog`
- Monorepo tooling: `pnpm workspaces`, `Turborepo`

## Monorepo Layout

```text
medicore/
|-- apps/
|   |-- api/                    # Express API
|   `-- web/                    # Next.js app
|-- packages/
|   |-- shared-constants/       # Shared enums/constants
|   |-- shared-types/           # Shared TypeScript types
|   `-- shared-validators/      # Shared Zod schemas/validators
`-- infrastructure/
    `-- docker/                 # Local and production container setup
```

## Core Product Areas

### Web dashboards

- `Admin`: overview, patients, doctors, appointments, billing, reports, settings
- `Receptionist`: check-in, booking, patient registration, today's list
- `Doctor`: queue, patients, appointments, EMR, prescriptions, lab
- `Nurse`: queue, vitals, triage, patient monitoring
- `Pharmacy`: prescriptions, inventory, dispense, stock alerts
- `Laboratory`: worklist, result entry, critical alerts, test catalog
- `Billing`: invoices, payments, outstanding balances, daily reports
- `Emergency`: intake, triage, beds, trauma
- `Patient portal`: personal health summary, appointments, results, prescriptions, bills

### API domains

The backend includes modules for:

- `auth`, `users`, `admin`, `audit`
- `patients`, `doctors`, `appointments`, `queue`
- `emr`, `laboratory`, `pharmacy`, `radiology`
- `emergency`, `billing`, `reports`, `notifications`
- `portal`, `telemedicine`, `settings`, `i18n`

## Getting Started

### Prerequisites

- `Node.js >= 20`
- `pnpm >= 9`
  Recommended: `pnpm 10.x`
- `Docker` and `Docker Compose`

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy the API example file:

```bash
cp apps/api/.env.example apps/api/.env
```

Create `apps/web/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3000
```

### 3. Start local infrastructure

This starts:

- `PostgreSQL` on `localhost:5433`
- `Redis` on `localhost:6379`
- `MailHog` on `localhost:8025`

```bash
cd infrastructure/docker
docker compose up -d
```

### 4. Run database migrations and seed data

From the repo root:

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Start the app

```bash
pnpm dev
```

Local URLs:

- Web: `http://localhost:3001`
- API: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- MailHog: `http://localhost:8025`

## Local Demo Accounts

After seeding, local demo users are available for testing role-based dashboards.

Default local password for seeded users:

```text
Admin@123456
```

Usernames:

- `superadmin`
- `admin1`
- `dr.ahmad`
- `nurse.sara`
- `reception1`
- `pharmacist1`
- `labtech1`
- `accountant1`

> Local demo credentials only.
> Change or remove them before using this project anywhere outside local development.

## Useful Commands

From the repo root:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm type-check
pnpm test
pnpm db:migrate
pnpm db:seed
```

Package-specific examples:

```bash
pnpm --filter @medicore/api dev
pnpm --filter @medicore/web dev
```

## Internationalization

The UI is localized for:

- `en` - English
- `fa` - Dari/Farsi
- `ps` - Pashto

Locale routes are prefixed automatically, for example:

- `/en`
- `/fa`
- `/ps`

## Production Notes

Production-oriented Docker, Redis, PostgreSQL, and Nginx config lives in:

- [`infrastructure/docker/docker-compose.prod.yml`](infrastructure/docker/docker-compose.prod.yml)
- [`infrastructure/docker/.env.prod.example`](infrastructure/docker/.env.prod.example)

Treat that setup as a starting point, not a finished deployment template.
Before public deployment you should at minimum review:

- secrets and credential rotation
- TLS certificates and key management
- database and Redis hardening
- CI/CD validation
- test coverage
- lint/build cleanup
- audit/compliance requirements for healthcare data

## Status

Current focus is local development and feature iteration.

What is in good shape:

- broad product coverage across major hospital workflows
- shared type/validator packages
- Dockerized local dependencies
- multilingual UI routing and role-based dashboards

What still needs polish:

- production hardening
- broader automated test reliability
- lint/build cleanup in some app areas
- security review for a public/shared deployment

## Disclaimer

This software is not medical advice and should not be used in a real hospital or patient-care environment without a full engineering, security, legal, privacy, and clinical review.
