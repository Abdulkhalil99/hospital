'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { api }                 from '@/lib/api';

const NAV = [
  { label: 'Invoices',     icon: '📄', path: '/dashboard/billing' },
  { label: 'Payments',     icon: '💳', path: '/dashboard/billing/payments' },
  { label: 'Outstanding',  icon: '⏳', path: '/dashboard/billing/outstanding' },
  { label: 'Daily report', icon: '📊', path: '/dashboard/billing/report' },
];

export default function DailyReport({ params: { locale } }: { params: { locale: string } }) {
  const nav   = NAV.map(n => ({ ...n, path: `/${locale}${n.path}` }));
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
    <DashboardShell navItems={nav} title="Daily Revenue Report" locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Report for: {date}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total revenue"     value={`AFN ${totalRevenue.toLocaleString()}`} icon="💰" color="#0F6E56" />
        <StatCard label="Transactions"      value={totalTx} icon="🧾" color="#185FA5" />
        <StatCard label="Cashiers active"   value={cashier.length} icon="👤" color="#854F0B" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Revenue by payment method</div>
        <DataTable
          keyField="payment_method" loading={loading} rows={revenue} empty="No transactions today"
          columns={[
            { key: 'payment_method', label: 'Method',
              render: r => <strong style={{ textTransform: 'capitalize' }}>{String(r.payment_method).replace('_',' ')}</strong> },
            { key: 'transaction_count', label: 'Transactions', width: '130px' },
            { key: 'total_amount', label: 'Total', width: '160px',
              render: r => <strong style={{ color: '#0F6E56' }}>AFN {Number(r.total_amount).toLocaleString()}</strong> },
          ]}
        />
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cashier summary</div>
        <DataTable
          keyField="cashier_name" loading={loading} rows={cashier} empty="No cashier activity"
          columns={[
            { key: 'cashier_name',      label: 'Cashier', render: r => <strong>{String(r.cashier_name)}</strong> },
            { key: 'transaction_count', label: 'Transactions', width: '130px' },
            { key: 'cash_total',        label: 'Cash', width: '130px',
              render: r => `AFN ${Number(r.cash_total ?? 0).toLocaleString()}` },
            { key: 'card_total',        label: 'Card', width: '130px',
              render: r => `AFN ${Number(r.card_total ?? 0).toLocaleString()}` },
            { key: 'total_collected',   label: 'Total', width: '140px',
              render: r => <strong style={{ color: '#0F6E56' }}>AFN {Number(r.total_collected).toLocaleString()}</strong> },
          ]}
        />
      </div>
    </DashboardShell>
  );
}
