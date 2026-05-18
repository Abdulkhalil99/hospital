'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function AdminBilling({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [status,   setStatus]   = useState('');

  useEffect(() => {
    const qs = status ? `?status=${status}&limit=30` : '?limit=30';
    api.get<any>(`/billing${qs}`)
      .then(r => { setInvoices(r.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const STATUS_PRESET: Record<string,any> = {
    draft:'gray', issued:'info', partial:'warning', paid:'success', cancelled:'danger', void:'gray',
  };

  return (
    <DashboardShell navItems={nav} title={t('nav.billing')} locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t('Invoices')}</div>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">{t('All statuses')}</option>
          {['draft','issued','partial','paid','cancelled','void'].map(s => <option key={s} value={s}>{t(s)}</option>)}
        </select>
      </div>
      <DataTable
        keyField="id" loading={loading} rows={invoices} empty={t('No invoices found')}
        columns={[
          { key: 'invoice_number', label: t('Invoice #'), width: '160px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(r.invoice_number)}</span> },
          { key: 'patient_name', label: t('dash.patient'), render: r => <strong>{String(r.patient_name)}</strong> },
          { key: 'total_amount', label: t('dash.total'), width: '130px',
            render: r => `AFN ${Number(r.total_amount).toLocaleString()}` },
          { key: 'paid_amount', label: t('dash.paid'), width: '130px',
            render: r => <span style={{ color: '#166534' }}>AFN {Number(r.paid_amount).toLocaleString()}</span> },
          { key: 'balance_due', label: t('dash.balance'), width: '130px',
            render: r => <strong style={{ color: Number(r.balance_due) > 0 ? '#991b1b' : '#166534' }}>AFN {Number(r.balance_due).toLocaleString()}</strong> },
          { key: 'status', label: t('dash.status'), width: '90px',
            render: r => <Badge label={t(String(r.status))} preset={STATUS_PRESET[String(r.status)] ?? 'gray'} /> },
        ]}
      />
    </DashboardShell>
  );
}
