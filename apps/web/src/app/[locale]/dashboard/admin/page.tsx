'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function AdminDashboard({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [stats,    setStats]    = useState<any>({});
  const [patients, setPatients] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>('/patients?limit=5'),
      api.get<any[]>('/doctors'),
      api.get<any[]>('/pharmacy/alerts/low-stock'),
      api.get<any[]>('/laboratory/critical-alerts'),
    ]).then(([pt, dr, ph, lb]) => {
      setStats({ patients: pt.pagination?.total ?? 0, doctors: dr.length ?? 0, lowStock: ph.length ?? 0, critAlerts: lb.length ?? 0 });
      setPatients(pt.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <DashboardShell navItems={nav} title={t('nav.overview')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label={t('nav.patients')}   value={stats.patients   ?? '…'} icon="👥" color="#185FA5" />
        <StatCard label={t('nav.doctors')}    value={stats.doctors    ?? '…'} icon="👨‍⚕️" color="#0F6E56" />
        <StatCard label={t('nav.inventory')}  value={stats.lowStock   ?? '…'} icon="💊" color="#854F0B" />
        <StatCard label={t('nav.critical')}   value={stats.critAlerts ?? '…'} icon="🚨" color="#991b1b" />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('nav.patients')}</div>
      <DataTable
        keyField="id" loading={loading} rows={patients} empty={t('dash.nodata')}
        columns={[
          { key: 'mrn',          label: t('dash.mrn'), width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(r.mrn)}</span> },
          { key: 'first_name',   label: t('dash.name'),
            render: r => `${r.first_name} ${r.last_name}` },
          { key: 'date_of_birth',label: t('dash.dob'), width: '140px',
            render: r => formatDate(String(r.date_of_birth ?? ''), locale) },
          { key: 'gender',       label: t('dash.gender'), width: '90px',
            render: r => <Badge label={String(r.gender)} preset="info" /> },
          { key: 'phone',        label: t('dash.phone') },
          { key: 'has_allergies',label: t('dash.allergy'), width: '90px',
            render: r => r.has_allergies ? <Badge label="⚠" preset="danger" /> : <Badge label="—" preset="gray" /> },
        ]}
      />
    </DashboardShell>
  );
}
