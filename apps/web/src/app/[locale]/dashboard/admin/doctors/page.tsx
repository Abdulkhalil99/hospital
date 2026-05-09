'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function AdminDoctors({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [doctors,  setDoctors]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get<any[]>('/doctors')
      .then(d => { setDoctors(d ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <DashboardShell navItems={nav} title="Doctors" locale={locale}>
      <DataTable
        keyField="id" loading={loading} rows={doctors} empty="No doctors found"
        columns={[
          { key: 'full_name', label: 'Name',
            render: r => <strong>{`${r.title} ${r.full_name}`}</strong> },
          { key: 'license_number', label: 'License', width: '150px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(r.license_number)}</span> },
          { key: 'specialty_name', label: 'Specialty' },
          { key: 'department_name', label: 'Department' },
          { key: 'consultation_fee', label: 'Fee', width: '100px',
            render: r => `AFN ${Number(r.consultation_fee).toLocaleString()}` },
          { key: 'is_available', label: 'Status', width: '100px',
            render: r => <Badge label={r.is_available ? 'Available' : 'Unavailable'} preset={r.is_available ? 'success' : 'danger'} /> },
        ]}
      />
    </DashboardShell>
  );
}
