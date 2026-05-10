'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, LAB_NAV } from '@/lib/nav';

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(LAB_NAV, locale, t);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function loadAlerts() {
    setLoading(true);
    try {
      const rows = await api.get<any[]>('/laboratory/critical-alerts');
      setAlerts(rows ?? []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  async function acknowledge(alertId: string) {
    try {
      await api.post(`/laboratory/critical-alerts/${alertId}/acknowledge`, {});
      setMsg('Critical alert acknowledged.');
      loadAlerts();
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to acknowledge alert.');
    }
  }

  return (
    <DashboardShell navItems={nav} title="Critical Alerts" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Pending alerts" value={alerts.length} icon="🚨" color="#991b1b" />
        <StatCard label="Unique patients" value={new Set(alerts.map((row) => row.patient_mrn)).size} icon="👥" color="#185FA5" />
        <StatCard label="Acknowledgment queue" value={alerts.filter((row) => !row.acknowledged_at).length} icon="⏱️" color="#854F0B" />
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          background: msg.toLowerCase().includes('failed') ? '#fef2f2' : '#f0fdf4',
          color: msg.toLowerCase().includes('failed') ? '#991b1b' : '#166534',
        }}>
          {msg}
        </div>
      )}

      <DataTable
        keyField="id"
        loading={loading}
        rows={alerts}
        empty="No pending critical alerts."
        columns={[
          { key: 'patient_name', label: 'Patient', render: (row) => <strong>{String(row.patient_name ?? '—')}</strong> },
          { key: 'patient_mrn', label: 'MRN', width: '130px' },
          { key: 'component_name', label: 'Component' },
          { key: 'result_value', label: 'Result', width: '100px' },
          { key: 'unit', label: 'Unit', width: '80px' },
          { key: 'doctor_name', label: 'Ordering doctor' },
          {
            key: 'flag',
            label: 'Flag',
            width: '90px',
            render: (row) => <Badge label={String(row.flag ?? 'CRIT')} preset="danger" />,
          },
          {
            key: 'action',
            label: '',
            width: '120px',
            render: (row) => <button onClick={() => acknowledge(String(row.id))} style={{ fontSize: 12, padding: '5px 12px' }}>Acknowledge</button>,
          },
        ]}
      />
    </DashboardShell>
  );
}
