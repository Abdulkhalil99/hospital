'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, PHARMACY_NAV } from '@/lib/nav';

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(PHARMACY_NAV, locale, t);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/pharmacy/alerts/low-stock'),
      api.get<any[]>('/pharmacy/inventory'),
    ]).then(([alertRows, inventoryRows]) => {
      setAlerts(alertRows ?? []);
      setInventory(inventoryRows ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const expiringSoon = inventory.filter((row) => {
    if (!row.expiry_date) return false;
    const expiry = new Date(String(row.expiry_date));
    const diffDays = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
    return diffDays >= 0 && diffDays <= 90;
  });

  return (
    <DashboardShell navItems={nav} title="Stock Alerts" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Alert rows" value={alerts.length} icon="⚠️" color="#854F0B" />
        <StatCard label="Out of stock" value={alerts.filter((row) => row.alert_type === 'out_of_stock').length} icon="🚫" color="#991b1b" />
        <StatCard label="Expiring in 90 days" value={expiringSoon.length} icon="⏳" color="#185FA5" />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('Low stock and out-of-stock alerts')}</div>
      <DataTable
        keyField="inventory_id"
        loading={loading}
        rows={alerts}
        empty="No pharmacy alerts right now."
        columns={[
          { key: 'generic_name', label: 'Drug', render: (row) => <strong>{String(row.generic_name ?? '—')}</strong> },
          { key: 'location', label: 'Location', width: '130px' },
          {
            key: 'quantity_on_hand',
            label: 'On hand',
            width: '90px',
            render: (row) => <strong>{String(row.quantity_on_hand ?? 0)}</strong>,
          },
          { key: 'reorder_level', label: 'Reorder', width: '90px' },
          {
            key: 'alert_type',
            label: 'Alert',
            width: '140px',
            render: (row) => {
              const type = String(row.alert_type ?? 'unknown');
              const preset = type === 'out_of_stock' ? 'danger' : type === 'expiring_soon' ? 'warning' : 'info';
              return <Badge label={type.replace('_', ' ')} preset={preset as any} />;
            },
          },
          {
            key: 'expiry_date',
            label: 'Expiry',
            width: '120px',
            render: (row) => row.expiry_date ? String(row.expiry_date).slice(0, 10) : '—',
          },
        ]}
      />

      <div style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 12px' }}>{t('Upcoming expiries')}</div>
      <DataTable
        keyField="id"
        loading={loading}
        rows={expiringSoon}
        empty="No batches expiring in the next 90 days."
        columns={[
          { key: 'generic_name', label: 'Drug', render: (row) => <strong>{String(row.generic_name ?? '—')}</strong> },
          { key: 'location', label: 'Location', width: '130px' },
          { key: 'batch_number', label: 'Batch', width: '140px' },
          { key: 'quantity_on_hand', label: 'On hand', width: '90px' },
          {
            key: 'expiry_date',
            label: 'Expiry',
            width: '120px',
            render: (row) => row.expiry_date ? String(row.expiry_date).slice(0, 10) : '—',
          },
          {
            key: 'days_left',
            label: 'Days left',
            width: '100px',
            render: (row) => {
              const expiry = row.expiry_date ? new Date(String(row.expiry_date)) : null;
              const days = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
              return days === null ? '—' : <Badge label={`${days} ${t(days === 1 ? 'day' : 'days')}`} preset={days <= 30 ? 'danger' : 'warning'} />;
            },
          },
        ]}
      />
    </DashboardShell>
  );
}
