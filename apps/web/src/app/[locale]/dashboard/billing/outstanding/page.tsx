'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, BILLING_NAV } from '@/lib/nav';

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(BILLING_NAV, locale, t);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<any[]>('/billing/reports/outstanding')
      .then((data) => {
        setRows(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = rows.filter((row) => {
    const text = `${row.patient_name ?? ''} ${row.patient_mrn ?? ''} ${row.invoice_number ?? ''} ${row.patient_phone ?? ''}`.toLowerCase();
    return !search.trim() || text.includes(search.trim().toLowerCase());
  });

  const totalOutstanding = filtered.reduce((sum, row) => sum + Number(row.balance_due ?? 0), 0);

  return (
    <DashboardShell navItems={nav} title="Outstanding Balances" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Invoices" value={filtered.length} icon="📄" color="#185FA5" />
        <StatCard label="Outstanding total" value={`AFN ${totalOutstanding.toLocaleString()}`} icon="⏳" color="#991b1b" />
        <StatCard label="Patients owing" value={new Set(filtered.map((row) => row.patient_mrn)).size} icon="👥" color="#854F0B" />
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px', marginBottom: 16 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, patient, MRN, or phone..." />
      </div>

      <DataTable
        keyField="id"
        loading={loading}
        rows={filtered}
        empty="No outstanding balances found."
        columns={[
          { key: 'invoice_number', label: 'Invoice #', width: '160px', render: (row) => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(row.invoice_number ?? '—')}</span> },
          { key: 'patient_name', label: 'Patient', render: (row) => <strong>{String(row.patient_name ?? '—')}</strong> },
          { key: 'patient_mrn', label: 'MRN', width: '130px' },
          { key: 'patient_phone', label: 'Phone', width: '140px' },
          {
            key: 'balance_due',
            label: 'Balance',
            width: '130px',
            render: (row) => <strong style={{ color: '#991b1b' }}>AFN {Number(row.balance_due ?? 0).toLocaleString()}</strong>,
          },
          {
            key: 'total_amount',
            label: 'Total',
            width: '130px',
            render: (row) => `AFN ${Number(row.total_amount ?? 0).toLocaleString()}`,
          },
          {
            key: 'status',
            label: 'Status',
            width: '100px',
            render: (row) => {
              const status = String(row.status ?? 'issued');
              return <Badge label={status} preset={status === 'partial' ? 'warning' : 'info'} />;
            },
          },
        ]}
      />
    </DashboardShell>
  );
}
