'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { useT }            from '@/lib/i18n';

const NAV = [
  { label: 'Pending Rx',  icon: '💊', path: '' },
  { label: 'Inventory',   icon: '📦', path: 'inventory' },
  { label: 'Dispense',    icon: '✅', path: 'dispense' },
  { label: 'Stock alerts',icon: '⚠️', path: 'alerts' },
];

export default function PharmacyDashboard({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const base = `/${locale}/dashboard/pharmacy`;
  const nav  = NAV.map(n => ({ ...n, path: n.path ? `${base}/${n.path}` : base }));

  const [pending,   setPending]   = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [alerts,    setAlerts]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/pharmacy/prescriptions/pending'),
      api.get<any[]>('/pharmacy/inventory'),
      api.get<any[]>('/pharmacy/alerts/low-stock'),
    ]).then(([p, inv, al]) => {
      setPending(p ?? []); setInventory(inv ?? []); setAlerts(al ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <DashboardShell navItems={nav} title="Pharmacy Dashboard" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Pending prescriptions" value={pending.length}   icon="💊" color="#185FA5" />
        <StatCard label="Stock alerts"          value={alerts.length}    icon="⚠️" color="#854F0B" />
        <StatCard label="Total drugs"           value={inventory.length} icon="📦" color="#0F6E56" />
      </div>

      {alerts.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 8 }}>⚠ {t('Stock Alerts')}</div>
          {alerts.slice(0,5).map((a: any, i: number) => (
            <div key={i} style={{ fontSize: 13, color: '#78350f', padding: '3px 0' }}>
              <strong>{a.generic_name}</strong> — {t(String(a.alert_type).replace('_',' '))} ({a.quantity_on_hand} {t('left')})
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('Pending prescriptions')}</div>
      <DataTable
        keyField="id" loading={loading} rows={pending} empty="No pending prescriptions"
        columns={[
          { key: 'patient_name',      label: 'Patient' },
          { key: 'patient_mrn',       label: 'MRN', width: '130px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(r.patient_mrn ?? '—')}</span> },
          { key: 'drug_name',         label: 'Drug', render: r => <strong>{String(r.drug_name)}</strong> },
          { key: 'dosage',            label: 'Dose', width: '100px' },
          { key: 'frequency',         label: 'Frequency' },
          { key: 'has_allergies',     label: 'Safety', width: '90px',
            render: r => r.has_allergies ? <Badge label="⚠ Allergy" preset="danger" /> : <Badge label="Safe" preset="success" /> },
        ]}
      />
    </DashboardShell>
  );
}
