'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { useT, formatDate } from '@/lib/i18n';
import { resolveNav, DOCTOR_NAV } from '@/lib/nav';

export default function DoctorPatients({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(DOCTOR_NAV, locale, t);

  const [patients, setPatients] = useState<any[]>([]);
  const [q,        setQ]        = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/patients?q=${q}&limit=30`)
      .then(r => { setPatients(r.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [q]);

  return (
    <DashboardShell navItems={nav} title={t('nav.patients')} locale={locale}>
      <div style={{ marginBottom: 16 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search name, MRN, phone…')} />
      </div>
      <DataTable
        keyField="id" loading={loading} rows={patients} empty={t('dash.nodata')}
        columns={[
          { key: 'mrn', label: t('dash.mrn'), width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(r.mrn)}</span> },
          { key: 'first_name', label: t('dash.name'), render: r => <strong>{`${r.first_name} ${r.last_name}`}</strong> },
          { key: 'date_of_birth', label: t('DOB'), width: '120px',
            render: r => r.date_of_birth ? formatDate(String(r.date_of_birth), locale) : '—' },
          { key: 'gender', label: t('dash.gender'), width: '90px',
            render: r => <Badge label={t(String(r.gender))} preset="info" /> },
          { key: 'blood_type', label: t('dash.blood'), width: '80px' },
          { key: 'phone', label: t('dash.phone') },
          { key: 'has_allergies', label: t('dash.allergy'), width: '90px',
            render: r => r.has_allergies ? <Badge label={t('yes')} preset="danger" /> : <Badge label={t('no')} preset="gray" /> },
        ]}
      />
    </DashboardShell>
  );
}
