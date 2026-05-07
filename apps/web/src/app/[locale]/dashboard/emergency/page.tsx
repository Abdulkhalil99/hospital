'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';

const NAV = [
  { label: 'ED Board',   icon: '🏥', path: '' },
  { label: 'Triage',     icon: '🚨', path: 'triage' },
  { label: 'Beds',       icon: '🛏️', path: 'beds' },
  { label: 'Trauma',     icon: '⚡', path: 'trauma' },
];

const ESI: Record<number, { label: string; preset: 'danger' | 'warning' | 'info' | 'success' | 'gray' }> = {
  1: { label: 'ESI 1 — Immediate', preset: 'danger' },
  2: { label: 'ESI 2 — Emergent',  preset: 'warning' },
  3: { label: 'ESI 3 — Urgent',    preset: 'info' },
  4: { label: 'ESI 4 — Less urgent',preset: 'success' },
  5: { label: 'ESI 5 — Non-urgent', preset: 'gray' },
};

export default function EmergencyDashboard({ params: { locale } }: { params: { locale: string } }) {
  const base = `/${locale}/dashboard/emergency`;
  const nav  = NAV.map(n => ({ ...n, path: n.path ? `${base}/${n.path}` : base }));

  const [dashboard, setDashboard] = useState<any>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    api.get<any>('/emergency/dashboard')
      .then(d => { setDashboard(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const stats  = dashboard?.stats  ?? {};
  const visits = dashboard?.visits ?? [];

  return (
    <DashboardShell navItems={nav} title="Emergency Department" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Active now"   value={stats.active_count    ?? 0} icon="🚨" color="#991b1b" />
        <StatCard label="Today total"  value={stats.total_visits    ?? 0} icon="📋" color="#185FA5" />
        <StatCard label="ESI Level 1"  value={stats.level_1_count  ?? 0} icon="❗" color="#991b1b" />
        <StatCard label="Discharged"   value={stats.discharged_count ?? 0} icon="✅" color="#0F6E56" />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Active ED visits</div>
      <DataTable
        keyField="id" loading={loading} rows={visits} empty="No active visits"
        columns={[
          { key: 'patient_name', label: 'Patient', render: r => <strong>{String(r.patient_name ?? 'Unknown')}</strong> },
          { key: 'chief_complaint', label: 'Complaint',
            render: r => <span style={{ fontSize: 13, color: '#555', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r.chief_complaint)}</span> },
          { key: 'triage_level', label: 'ESI', width: '160px',
            render: r => {
              const l = Number(r.triage_level);
              const e = ESI[l];
              return e ? <Badge label={e.label} preset={e.preset} /> : <Badge label="Untriaged" preset="gray" />;
            }},
          { key: 'bed_code', label: 'Bed', width: '90px',
            render: r => r.bed_code ? <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#185FA5' }}>{String(r.bed_code)}</span> : <span style={{ color: '#aaa' }}>—</span> },
          { key: 'minutes_in_ed', label: 'Time in ED', width: '100px',
            render: r => {
              const m = Math.floor(Number(r.minutes_in_ed ?? 0));
              const s = m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
              return <span style={{ color: m > 120 ? '#991b1b' : '#555', fontWeight: m > 120 ? 600 : 400 }}>{s}</span>;
            }},
          { key: 'status', label: 'Status', width: '110px',
            render: r => <Badge label={String(r.status)} preset="info" /> },
        ]}
      />
    </DashboardShell>
  );
}
