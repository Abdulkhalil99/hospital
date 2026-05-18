'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { PatientRegistrationForm } from '@/components/patients/PatientRegistrationForm';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, RECEPTIONIST_NAV } from '@/lib/nav';

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(RECEPTIONIST_NAV, locale, t);

  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api.get<any>(`/patients?q=${encodeURIComponent(query)}&limit=30&page=1`)
        .then((res) => {
          setPatients(res.data ?? []);
          setTotal(res.pagination?.total ?? res.data?.length ?? 0);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <DashboardShell navItems={nav} title={t('nav.patients')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label={t('Total patients')} value={total} icon="👥" color="#185FA5" />
        <StatCard label={t('Loaded records')} value={patients.length} icon="📋" color="#0F6E56" />
        <StatCard label={t('Allergy flags')} value={patients.filter((p) => p.has_allergies).length} icon="⚠️" color="#991b1b" />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Search patient by name, MRN, or phone…')}
          style={{ flex: 1 }}
        />
        <button onClick={() => setShowRegister((current) => !current)}>
          {showRegister ? t('Hide form') : t('dash.register')}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: '#f0fdf4', color: '#166534' }}>
          {msg}
        </div>
      )}

      {showRegister && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('New patient registration')}</div>
          <PatientRegistrationForm
            onSuccess={(mrn) => {
              setMsg(t('Patient registered successfully. MRN: {{mrn}}', { mrn }));
              setShowRegister(false);
              setQuery('');
              api.get<any>('/patients?limit=30&page=1').then((res) => {
                setPatients(res.data ?? []);
                setTotal(res.pagination?.total ?? res.data?.length ?? 0);
              });
            }}
          />
        </div>
      )}

      <DataTable
        keyField="id"
        loading={loading}
        rows={patients}
        empty={t('dash.nodata')}
        columns={[
          {
            key: 'mrn',
            label: t('dash.mrn'),
            width: '140px',
            render: (row) => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(row.mrn ?? '—')}</span>,
          },
          {
            key: 'name',
            label: t('dash.patient'),
            render: (row) => <strong>{`${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—'}</strong>,
          },
          {
            key: 'date_of_birth',
            label: t('dash.dob'),
            width: '130px',
            render: (row) => row.date_of_birth ? formatDate(String(row.date_of_birth), locale) : '—',
          },
          {
            key: 'gender',
            label: t('dash.gender'),
            width: '90px',
            render: (row) => <Badge label={t(String(row.gender ?? '—'))} preset="info" />,
          },
          { key: 'phone', label: t('dash.phone'), width: '130px' },
          {
            key: 'has_allergies',
            label: t('dash.allergy'),
            width: '100px',
            render: (row) => row.has_allergies ? <Badge label={t('yes')} preset="danger" /> : <Badge label={t('no')} preset="gray" />,
          },
        ]}
      />
    </DashboardShell>
  );
}
