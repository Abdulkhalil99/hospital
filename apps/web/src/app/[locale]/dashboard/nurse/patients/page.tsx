'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard } from '@/components/layout/StatCard';
import { DataTable } from '@/components/layout/DataTable';
import { Badge } from '@/components/layout/Badge';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { resolveNav, NURSE_NAV } from '@/lib/nav';

function esiPreset(level: number) {
  if (level === 1) return 'danger';
  if (level === 2) return 'warning';
  if (level === 3) return 'info';
  if (level === 4) return 'success';
  return 'gray';
}

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(NURSE_NAV, locale, t);
  const today = new Date().toISOString().split('T')[0];

  const [appointments, setAppointments] = useState<any[]>([]);
  const [emergencyVisits, setEmergencyVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [appointmentRows, dashboard] = await Promise.all([
          api.get<any>(`/appointments?date=${today}&limit=100&status=checked_in`),
          api.get<any>('/emergency/dashboard'),
        ]);
        setAppointments(appointmentRows.data ?? []);
        setEmergencyVisits(dashboard?.visits ?? []);
      } finally {
        setLoading(false);
      }
    }

    load().catch(() => setLoading(false));
  }, [today]);

  const filteredAppointments = appointments.filter((appointment) => {
    const haystack = [
      appointment.patient_name,
      appointment.patient_mrn,
      appointment.doctor_name,
      appointment.notes,
    ].join(' ').toLowerCase();
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  });

  const filteredEmergency = emergencyVisits.filter((visit) => {
    const haystack = [
      visit.patient_name,
      visit.patient_mrn,
      visit.chief_complaint,
      visit.bed_code,
    ].join(' ').toLowerCase();
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  });

  return (
    <DashboardShell navItems={nav} title="Patients" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Checked in OPD" value={appointments.length} icon="✅" color="#0F6E56" />
        <StatCard label="Active ED" value={emergencyVisits.length} icon="🚨" color="#991b1b" />
        <StatCard label="Critical ED" value={emergencyVisits.filter((visit) => [1, 2].includes(Number(visit.triage_level))).length} icon="⚡" color="#854F0B" />
        <StatCard label="Bedded ED" value={emergencyVisits.filter((visit) => visit.bed_code).length} icon="🛏️" color="#185FA5" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient, MRN, doctor, bed, or complaint..."
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Outpatient patients awaiting nursing support</div>
        <DataTable
          keyField="id"
          loading={loading}
          rows={filteredAppointments}
          empty="No checked-in outpatient patients."
          columns={[
            {
              key: 'patient_name',
              label: 'Patient',
              render: (row) => <strong>{String(row.patient_name ?? '—')}</strong>,
            },
            {
              key: 'patient_mrn',
              label: 'MRN',
              width: '130px',
              render: (row) => <span style={{ fontFamily: 'monospace', color: '#185FA5' }}>{String(row.patient_mrn ?? '—')}</span>,
            },
            { key: 'doctor_name', label: 'Doctor' },
            {
              key: 'scheduled_start',
              label: 'Time',
              width: '90px',
              render: (row) => <span style={{ fontFamily: 'monospace' }}>{String(row.scheduled_start ?? '').slice(0, 5)}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              width: '110px',
              render: (row) => <Badge label={String(row.status ?? 'checked_in')} preset="warning" />,
            },
          ]}
        />
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Emergency department active patients</div>
        <DataTable
          keyField="id"
          loading={loading}
          rows={filteredEmergency}
          empty="No active emergency visits."
          columns={[
            {
              key: 'patient_name',
              label: 'Patient',
              render: (row) => (
                <div>
                  <strong>{String(row.patient_name ?? 'Unknown patient')}</strong>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{String(row.patient_mrn ?? 'No MRN')}</div>
                </div>
              ),
            },
            { key: 'chief_complaint', label: 'Complaint' },
            {
              key: 'triage_level',
              label: 'ESI',
              width: '90px',
              render: (row) => row.triage_level
                ? <Badge label={`ESI ${row.triage_level}`} preset={esiPreset(Number(row.triage_level)) as any} />
                : <Badge label="Untriaged" preset="gray" />,
            },
            {
              key: 'bed_code',
              label: 'Bed',
              width: '90px',
              render: (row) => row.bed_code
                ? <span style={{ fontFamily: 'monospace', color: '#185FA5' }}>{String(row.bed_code)}</span>
                : <span style={{ color: '#9ca3af' }}>Unassigned</span>,
            },
            {
              key: 'minutes_in_ed',
              label: 'Time in ED',
              width: '100px',
              render: (row) => <span>{Math.floor(Number(row.minutes_in_ed ?? 0))}m</span>,
            },
            {
              key: 'status',
              label: 'Status',
              width: '110px',
              render: (row) => <Badge label={String(row.status ?? 'arrived')} preset="info" />,
            },
          ]}
        />
      </div>
    </DashboardShell>
  );
}
