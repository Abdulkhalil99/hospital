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

  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get<any[]>('/laboratory/tests')
      .then((rows) => {
        setTests(rows ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = tests.filter((row) => {
    const text = `${row.code ?? ''} ${row.name ?? ''} ${row.category ?? ''} ${row.sample_type ?? ''}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  });

  return (
    <DashboardShell navItems={nav} title={t('nav.catalog')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Active tests" value={tests.length} icon="🧪" color="#185FA5" />
        <StatCard label="Categories" value={new Set(tests.map((row) => row.category)).size} icon="📋" color="#0F6E56" />
        <StatCard label="Filtered" value={filtered.length} icon="🔎" color="#854F0B" />
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px', marginBottom: 16 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search test code, name, category, or sample..." />
      </div>

      <DataTable
        keyField="id"
        loading={loading}
        rows={filtered}
        empty="No laboratory tests found."
        columns={[
          { key: 'code', label: 'Code', width: '110px', render: (row) => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(row.code ?? '—')}</span> },
          { key: 'name', label: 'Test', render: (row) => <strong>{String(row.name ?? '—')}</strong> },
          { key: 'category', label: 'Category', width: '130px', render: (row) => <Badge label={String(row.category ?? '—')} preset="info" /> },
          { key: 'sample_type', label: 'Sample', width: '110px' },
          { key: 'turnaround_hours', label: 'TAT (hrs)', width: '90px' },
          {
            key: 'price',
            label: 'Price',
            width: '110px',
            render: (row) => row.price !== null && row.price !== undefined ? `AFN ${Number(row.price).toLocaleString()}` : '—',
          },
          { key: 'reference_ranges_count', label: 'Ranges', width: '80px' },
        ]}
      />
    </DashboardShell>
  );
}
