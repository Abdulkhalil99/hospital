'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { getSession }      from '@/lib/auth';

const NAV = [
  { label: 'My health',      icon: '❤️',  path: '' },
  { label: 'Appointments',   icon: '📅',  path: 'appointments' },
  { label: 'Lab results',    icon: '🧪',  path: 'results' },
  { label: 'Prescriptions',  icon: '💊',  path: 'prescriptions' },
  { label: 'Bills',          icon: '💰',  path: 'bills' },
];

export default function PatientDashboard({ params: { locale } }: { params: { locale: string } }) {
  const base = `/${locale}/dashboard/patient`;
  const nav  = NAV.map(n => ({ ...n, path: n.path ? `${base}/${n.path}` : base }));

  const [profile,  setProfile]  = useState<any>(null);
  const [appts,    setAppts]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session) return;

    api.get<any>('/auth/me').then(me => {
      setProfile(me);
      // Load appointments if patient has a portal account linked to a patient record
      return api.get<any>(`/appointments?limit=10`);
    }).then(a => {
      setAppts(a.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <DashboardShell navItems={nav} title="My Health Portal" locale={locale}>
      {profile && (
        <div style={{ background: 'linear-gradient(135deg, #185FA5, #0F6E56)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, color: '#fff' }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Welcome, {profile.fullName ?? profile.username}</div>
          <div style={{ fontSize: 13, opacity: .8 }}>Patient portal — MediCore Hospital</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Appointments" value={appts.length} icon="📅" color="#185FA5" />
        <StatCard label="Lab results"  value="—"            icon="🧪" color="#0F6E56" />
        <StatCard label="Pending bills"value="—"            icon="💰" color="#854F0B" />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Recent appointments</div>
      <DataTable
        keyField="id" loading={loading} rows={appts} empty="No appointments found"
        columns={[
          { key: 'scheduled_date',  label: 'Date', width: '120px' },
          { key: 'scheduled_start', label: 'Time', width: '80px',
            render: r => String(r.scheduled_start ?? '').slice(0,5) },
          { key: 'doctor_name',     label: 'Doctor' },
          { key: 'status',          label: 'Status', width: '110px',
            render: r => {
              const s = String(r.status);
              const p = s === 'completed' ? 'success' : s === 'cancelled' ? 'danger' : 'info';
              return <Badge label={s} preset={p as any} />;
            }},
        ]}
      />
    </DashboardShell>
  );
}
