'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { useT }            from '@/lib/i18n';
import { resolveNav, BILLING_NAV } from '@/lib/nav';

export default function BillingDashboard({ params: { locale } }: { params: { locale: string } }) {
  const t    = useT(locale);
  const nav  = resolveNav(BILLING_NAV, locale, t);

  const [invoices,     setInvoices]     = useState<any[]>([]);
  const [outstanding,  setOutstanding]  = useState<any[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      api.get<any>('/billing?limit=20&status=issued'),
      api.get<any[]>('/billing/reports/outstanding'),
      api.get<any[]>(`/billing/reports/daily?date=${today}`),
    ]).then(([inv, out, rev]) => {
      setInvoices(inv.data    ?? []);
      setOutstanding(out      ?? []);
      setDailyRevenue(rev     ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalRevenue = dailyRevenue.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
  const totalOutstanding = outstanding.reduce((s: number, r: any) => s + Number(r.balance_due ?? 0), 0);

  return (
    <DashboardShell navItems={nav} title={t('nav.invoices')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Today's revenue"   value={`AFN ${totalRevenue.toLocaleString()}`} icon="💰" color="#0F6E56" />
        <StatCard label="Open invoices"     value={invoices.length}                          icon="📄" color="#185FA5" />
        <StatCard label="Total outstanding" value={`AFN ${totalOutstanding.toLocaleString()}`} icon="⏳" color="#854F0B" />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('Open invoices')}</div>
      <DataTable
        keyField="id" loading={loading} rows={invoices} empty="No open invoices"
        columns={[
          { key: 'invoice_number', label: 'Invoice #', width: '160px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(r.invoice_number)}</span> },
          { key: 'patient_name',   label: 'dash.patient' },
          { key: 'total_amount',   label: 'dash.total', width: '120px',
            render: r => `AFN ${Number(r.total_amount).toLocaleString()}` },
          { key: 'balance_due',    label: 'dash.balance', width: '120px',
            render: r => <strong style={{ color: Number(r.balance_due) > 0 ? '#991b1b' : '#166534' }}>AFN {Number(r.balance_due).toLocaleString()}</strong> },
          { key: 'status', label: 'dash.status', width: '90px',
            render: r => {
              const s = String(r.status);
              return <Badge label={s} preset={s === 'paid' ? 'success' : s === 'partial' ? 'warning' : 'info'} />;
            }},
        ]}
      />
    </DashboardShell>
  );
}
