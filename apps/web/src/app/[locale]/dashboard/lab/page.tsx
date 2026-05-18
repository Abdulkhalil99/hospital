'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { useT }            from '@/lib/i18n';
import { resolveNav, LAB_NAV } from '@/lib/nav';

export default function LabDashboard({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(LAB_NAV, locale, t);

  const [worklist, setWorklist] = useState<any[]>([]);
  const [critical, setCritical] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      api.get<any[]>(`/laboratory/worklist?date=${today}`),
      api.get<any[]>('/laboratory/critical-alerts'),
    ]).then(([w, c]) => {
      setWorklist(w ?? []); setCritical(c ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const stat = (u: string) => worklist.filter((w: any) => w.urgency === u).length;

  return (
    <DashboardShell navItems={nav} title={t('nav.lab')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total pending" value={worklist.length}   icon="🧪" color="#185FA5" />
        <StatCard label="STAT orders"   value={stat('stat')}      icon="⚡" color="#991b1b" />
        <StatCard label="Urgent"        value={stat('urgent')}    icon="⚠️" color="#854F0B" />
        <StatCard label="Critical alerts" value={critical.length} icon="🚨" color="#991b1b" />
      </div>

      {critical.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>🚨 {t('Critical Values — Requires Immediate Action')}</div>
          {critical.map((c: any, i: number) => (
            <div key={i} style={{ fontSize: 13, color: '#7f1d1d', padding: '4px 0', borderTop: i > 0 ? '1px solid #fca5a5' : 'none' }}>
              <strong>{c.patient_name}</strong> ({c.patient_mrn}) — {c.component_name}: <strong>{c.result_value}</strong> <Badge label={String(c.flag)} preset="danger" />
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t("Today's worklist")}</div>
      <DataTable
        keyField="id" loading={loading} rows={worklist} empty="Worklist is empty"
        columns={[
          { key: 'urgency', label: 'dash.priority', width: '90px',
            render: r => {
              const u = String(r.urgency);
              return <Badge label={u.toUpperCase()} preset={u === 'stat' ? 'danger' : u === 'urgent' ? 'warning' : 'info'} />;
            }},
          { key: 'barcode',      label: 'dash.barcode', width: '160px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#185FA5' }}>{String(r.barcode ?? '—')}</span> },
          { key: 'patient_name', label: 'dash.patient' },
          { key: 'test_name',    label: 'Test', render: r => <strong>{String(r.test_name)}</strong> },
          { key: 'sample_type',  label: 'dash.sample', width: '90px' },
          { key: 'sample_status',label: 'dash.status', width: '110px',
            render: r => <Badge label={String(r.sample_status ?? r.status ?? '—')} preset="info" /> },
        ]}
      />
    </DashboardShell>
  );
}
