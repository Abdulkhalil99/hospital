'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { useT }            from '@/lib/i18n';
import { resolveNav, EMERGENCY_NAV } from '@/lib/nav';

export default function EmergencyDashboard({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(EMERGENCY_NAV, locale, t);
  const esi: Record<number, { label: string; preset: 'danger' | 'warning' | 'info' | 'success' | 'gray' }> = {
    1: { label: t('ESI 1 — Immediate'), preset: 'danger' },
    2: { label: t('ESI 2 — Emergent'),  preset: 'warning' },
    3: { label: t('ESI 3 — Urgent'),    preset: 'info' },
    4: { label: t('ESI 4 — Less urgent'), preset: 'success' },
    5: { label: t('ESI 5 — Non-urgent'), preset: 'gray' },
  };

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
    <DashboardShell navItems={nav} title={t('Emergency Department')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label={t('Active now')}   value={stats.active_count    ?? 0} icon="🚨" color="#991b1b" />
        <StatCard label={t('Today total')}  value={stats.total_visits    ?? 0} icon="📋" color="#185FA5" />
        <StatCard label={t('ESI Level 1')}  value={stats.level_1_count  ?? 0} icon="❗" color="#991b1b" />
        <StatCard label={t('Discharged')}   value={stats.discharged_count ?? 0} icon="✅" color="#0F6E56" />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('Active ED visits')}</div>
      <DataTable
        keyField="id" loading={loading} rows={visits} empty={t('No active visits')}
        columns={[
          { key: 'patient_name', label: t('dash.patient'), render: r => <strong>{String(r.patient_name ?? t('Unknown'))}</strong> },
          { key: 'chief_complaint', label: t('dash.complaint'),
            render: r => <span style={{ fontSize: 13, color: '#555', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r.chief_complaint)}</span> },
          { key: 'triage_level', label: 'ESI', width: '160px',
            render: r => {
              const l = Number(r.triage_level);
              const e = esi[l];
              return e ? <Badge label={e.label} preset={e.preset} /> : <Badge label={t('Untriaged')} preset="gray" />;
            }},
          { key: 'bed_code', label: t('dash.bed'), width: '90px',
            render: r => r.bed_code ? <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#185FA5' }}>{String(r.bed_code)}</span> : <span style={{ color: '#aaa' }}>—</span> },
          { key: 'minutes_in_ed', label: t('dash.timined'), width: '100px',
            render: r => {
              const m = Math.floor(Number(r.minutes_in_ed ?? 0));
              const s = m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
              return <span style={{ color: m > 120 ? '#991b1b' : '#555', fontWeight: m > 120 ? 600 : 400 }}>{s}</span>;
            }},
          { key: 'status', label: t('dash.status'), width: '110px',
            render: r => <Badge label={t(String(r.status))} preset="info" /> },
        ]}
      />
    </DashboardShell>
  );
}
