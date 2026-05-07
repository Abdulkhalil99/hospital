'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';

const NAV = [
  { label: 'Check-in',     icon: '✅', path: '' },
  { label: 'Book appt',    icon: '📅', path: 'book' },
  { label: 'Patients',     icon: '👥', path: 'patients' },
  { label: 'Today\'s list',icon: '📋', path: 'today' },
];

export default function ReceptionistDashboard({ params: { locale } }: { params: { locale: string } }) {
  const base = `/${locale}/dashboard/receptionist`;
  const nav  = NAV.map(n => ({ ...n, path: n.path ? `${base}/${n.path}` : base }));

  const today = new Date().toISOString().split('T')[0];
  const [appts,    setAppts]    = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [checkMsg, setCheckMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<any>(`/appointments?date=${today}&limit=50`),
    ]).then(([a]) => {
      setAppts(a.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) { setPatients([]); return; }
    const t = setTimeout(() => {
      api.get<any>(`/patients?q=${search}&limit=8`).then(r => setPatients(r.data ?? []));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function checkin(apptId: string) {
    try {
      const res = await api.post<any>(`/appointments/${apptId}/checkin`, {});
      setCheckMsg(`✅ Checked in — Token: ${res.token?.token_display}`);
      const a = await api.get<any>(`/appointments?date=${today}&limit=50`);
      setAppts(a.data ?? []);
    } catch (err: any) {
      setCheckMsg(`❌ ${err.message}`);
    }
    setTimeout(() => setCheckMsg(''), 4000);
  }

  const scheduled  = appts.filter((a: any) => a.status === 'scheduled').length;
  const checkedIn  = appts.filter((a: any) => a.status === 'checked_in').length;
  const completed  = appts.filter((a: any) => a.status === 'completed').length;

  return (
    <DashboardShell navItems={nav} title="Receptionist Dashboard" locale={locale}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Scheduled"  value={scheduled} icon="📅" color="#185FA5" />
        <StatCard label="Checked in" value={checkedIn} icon="✅" color="#0F6E56" />
        <StatCard label="Completed"  value={completed} icon="🏁" color="#888"    />
      </div>

      {/* Patient search */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Quick patient search</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, MRN, phone…" />
        {patients.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {patients.map((p: any) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: '#f8f9fa', fontSize: 13 }}>
                <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{p.mrn}</span>
                <span style={{ flex: 1 }}>{p.first_name} {p.last_name}</span>
                <span style={{ color: '#888' }}>{p.phone}</span>
                {p.has_allergies && <Badge label="⚠ Allergy" preset="danger" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {checkMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: checkMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: checkMsg.startsWith('✅') ? '#166534' : '#991b1b' }}>
          {checkMsg}
        </div>
      )}

      {/* Today's appointments */}
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Today's appointments — {today}</div>
      <DataTable
        keyField="id" loading={loading} rows={appts} empty="No appointments today"
        columns={[
          { key: 'scheduled_start', label: 'Time', width: '80px',
            render: r => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(r.scheduled_start ?? '').slice(0,5)}</span> },
          { key: 'patient_name', label: 'Patient', render: r => String(r.patient_name ?? '—') },
          { key: 'patient_mrn',  label: 'MRN', width: '130px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{String(r.patient_mrn ?? '—')}</span> },
          { key: 'doctor_name',  label: 'Doctor' },
          { key: 'status', label: 'Status', width: '110px',
            render: r => {
              const s = String(r.status);
              const p = s === 'checked_in' ? 'warning' : s === 'completed' ? 'success' : s === 'cancelled' ? 'danger' : 'info';
              return <Badge label={s} preset={p as any} />;
            }},
          { key: 'action', label: '', width: '100px',
            render: r => r.status === 'scheduled' || r.status === 'confirmed'
              ? <button onClick={() => checkin(String(r.id))} style={{ fontSize: 12, padding: '4px 12px', background: '#0F6E56' }}>Check in</button>
              : null },
        ]}
      />
    </DashboardShell>
  );
}
