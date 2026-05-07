'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';

const NAV = [
  { label: 'My Queue',      icon: '📋', path: '/dashboard/doctor' },
  { label: 'Appointments',  icon: '📅', path: '/dashboard/doctor/appointments' },
  { label: 'Patients',      icon: '👥', path: '/dashboard/doctor/patients' },
  { label: 'EMR',           icon: '📝', path: '/dashboard/doctor/emr' },
  { label: 'Prescriptions', icon: '💊', path: '/dashboard/doctor/prescriptions' },
  { label: 'Lab Orders',    icon: '🧪', path: '/dashboard/doctor/lab' },
];

export default function DoctorAppointments({ params: { locale } }: { params: { locale: string } }) {
  const nav = NAV.map(n => ({ ...n, path: `/${locale}${n.path}` }));

  const [appts,   setAppts]   = useState<any[]>([]);
  const [date,    setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    api.get<any>('/doctors/me').then(doc =>
      api.get<any>(`/appointments?doctorId=${doc.id}&date=${date}&limit=50`)
    ).then(r => { setAppts(r.data ?? []); setLoading(false); })
    .catch(() => setLoading(false));
  }, [date]);

  return (
    <DashboardShell navItems={nav} title="My Appointments" locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Appointments for {date}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>
      <DataTable
        keyField="id" loading={loading} rows={appts} empty="No appointments for this date"
        columns={[
          { key: 'scheduled_start', label: 'Time', width: '80px',
            render: r => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(r.scheduled_start ?? '').slice(0,5)}</span> },
          { key: 'patient_name', label: 'Patient', render: r => <strong>{String(r.patient_name ?? '—')}</strong> },
          { key: 'patient_mrn',  label: 'MRN', width: '130px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{String(r.patient_mrn ?? '—')}</span> },
          { key: 'type_name', label: 'Type' },
          { key: 'status', label: 'Status', width: '110px',
            render: r => {
              const s = String(r.status);
              const p = s === 'completed' ? 'success' : s === 'cancelled' ? 'danger' : s === 'checked_in' ? 'warning' : 'info';
              return <Badge label={s} preset={p as any} />;
            }},
          { key: 'notes', label: 'Notes',
            render: r => <span style={{ fontSize: 12, color: '#888' }}>{String(r.notes ?? '—')}</span> },
        ]}
      />
    </DashboardShell>
  );
}
