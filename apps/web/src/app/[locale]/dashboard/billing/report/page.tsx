'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, BILLING_NAV } from '@/lib/nav';

export default function DailyReport({ params: { locale } }: { params: { locale: string } }) {
  const t     = useT(locale);
  const nav   = resolveNav(BILLING_NAV, locale, t);
  const today = new Date().toISOString().split('T')[0];

  const [date,     setDate]     = useState(today);
  const [revenue,  setRevenue]  = useState<any[]>([]);
  const [cashier,  setCashier]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    const [rev, cash] = await Promise.all([
      api.get<any[]>(`/billing/reports/daily?date=${date}`),
      api.get<any[]>(`/billing/reports/cashier?date=${date}`),
    ]);
    setRevenue(rev ?? []); setCashier(cash ?? []);
    setLoading(false);
  }

  const totalRevenue = revenue.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const totalTx      = revenue.reduce((s, r) => s + Number(r.transaction_count ?? 0), 0);

  return (
    <DashboardShell navItems={nav} title={t('nav.report')} locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t('Report for')}: {date}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total revenue"     value={`AFN ${totalRevenue.toLocaleString()}`} icon="💰" color="#0F6E56" />
        <StatCard label="dash.transactions" value={totalTx} icon="🧾" color="#185FA5" />
        <StatCard label="Cashiers active"   value={cashier.length} icon="👤" color="#854F0B" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('Revenue by payment method')}</div>
        <DataTable
          keyField="payment_method" loading={loading} rows={revenue} empty="No transactions today"
          columns={[
            { key: 'payment_method', label: 'dash.method',
              render: r => <strong style={{ textTransform: 'capitalize' }}>{String(r.payment_method).replace('_',' ')}</strong> },
            { key: 'transaction_count', label: 'dash.transactions', width: '130px' },
            { key: 'total_amount', label: 'dash.total', width: '160px',
              render: r => <strong style={{ color: '#0F6E56' }}>AFN {Number(r.total_amount).toLocaleString()}</strong> },
          ]}
        />
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('Cashier summary')}</div>
        <DataTable
          keyField="cashier_name" loading={loading} rows={cashier} empty="No cashier activity"
          columns={[
            { key: 'cashier_name',      label: 'dash.cashier', render: r => <strong>{String(r.cashier_name)}</strong> },
            { key: 'transaction_count', label: 'dash.transactions', width: '130px' },
            { key: 'cash_total',        label: 'cash', width: '130px',
              render: r => `AFN ${Number(r.cash_total ?? 0).toLocaleString()}` },
            { key: 'card_total',        label: 'card', width: '130px',
              render: r => `AFN ${Number(r.card_total ?? 0).toLocaleString()}` },
            { key: 'total_collected',   label: 'dash.total', width: '140px',
              render: r => <strong style={{ color: '#0F6E56' }}>AFN {Number(r.total_collected).toLocaleString()}</strong> },
          ]}
        />
      </div>
    </DashboardShell>
  );
}
