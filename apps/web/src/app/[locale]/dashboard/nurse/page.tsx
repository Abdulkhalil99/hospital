'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard }        from '@/components/layout/StatCard';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { useT }            from '@/lib/i18n';
import { resolveNav, NURSE_NAV } from '@/lib/nav';

export default function NurseDashboard({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(NURSE_NAV, locale, t);
  const today = new Date().toISOString().split('T')[0];

  const [appts,   setAppts]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>(`/appointments?date=${today}&limit=50&status=checked_in`)
      .then(r => { setAppts(r.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <DashboardShell navItems={nav} title={t('Nurse Dashboard')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label={t('checked_in')}  value={appts.length} icon="✅" color="#0F6E56" />
        <StatCard label={t("Today's date")} value={today}       icon="📅" color="#185FA5" />
        <StatCard label={t('Pending vitals')} value={appts.filter((a:any) => a.status === 'checked_in').length} icon="💓" color="#854F0B" />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('Patients awaiting vitals')}</div>
      <DataTable
        keyField="id" loading={loading} rows={appts} empty={t('No patients waiting')}
        columns={[
          { key: 'patient_name', label: t('dash.patient'), render: r => <strong>{String(r.patient_name ?? '—')}</strong> },
          { key: 'patient_mrn',  label: t('dash.mrn'), width: '130px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(r.patient_mrn ?? '—')}</span> },
          { key: 'doctor_name',  label: t('dash.doctor') },
          { key: 'scheduled_start', label: t('dash.time'), width: '80px',
            render: r => <span style={{ fontFamily: 'monospace' }}>{String(r.scheduled_start ?? '').slice(0,5)}</span> },
          { key: 'status', label: t('dash.status'), width: '110px',
            render: r => <Badge label={t(String(r.status))} preset="warning" /> },
        ]}
      />
    </DashboardShell>
  );
}
