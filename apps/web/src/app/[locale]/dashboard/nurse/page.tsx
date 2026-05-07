'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';

const NAV = [
  { label: 'Queue',         icon: '📋', path: '' },
  { label: 'Vital signs',   icon: '💓', path: 'vitals' },
  { label: 'Triage',        icon: '🚨', path: 'triage' },
  { label: 'Patients',      icon: '👥', path: 'patients' },
];

export default function NurseDashboard({ params: { locale } }: { params: { locale: string } }) {
  const base = `/${locale}/dashboard/nurse`;
  const nav  = NAV.map(n => ({ ...n, path: n.path ? `${base}/${n.path}` : base }));
  const today = new Date().toISOString().split('T')[0];

  const [appts,   setAppts]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>(`/appointments?date=${today}&limit=50&status=checked_in`)
      .then(r => { setAppts(r.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <DashboardShell navItems={nav} title="Nurse Dashboard" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Checked in"  value={appts.length} icon="✅" color="#0F6E56" />
        <StatCard label="Today's date" value={today}       icon="📅" color="#185FA5" />
        <StatCard label="Pending vitals" value={appts.filter((a:any) => a.status === 'checked_in').length} icon="💓" color="#854F0B" />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Patients awaiting vitals</div>
      <DataTable
        keyField="id" loading={loading} rows={appts} empty="No patients waiting"
        columns={[
          { key: 'patient_name', label: 'Patient', render: r => <strong>{String(r.patient_name ?? '—')}</strong> },
          { key: 'patient_mrn',  label: 'MRN', width: '130px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(r.patient_mrn ?? '—')}</span> },
          { key: 'doctor_name',  label: 'Doctor' },
          { key: 'scheduled_start', label: 'Time', width: '80px',
            render: r => <span style={{ fontFamily: 'monospace' }}>{String(r.scheduled_start ?? '').slice(0,5)}</span> },
          { key: 'status', label: 'Status', width: '110px',
            render: r => <Badge label={String(r.status)} preset="warning" /> },
        ]}
      />
    </DashboardShell>
  );
}
