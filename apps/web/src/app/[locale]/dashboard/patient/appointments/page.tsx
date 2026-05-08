'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, PATIENT_NAV } from '@/lib/nav';

export default function MyAppointments({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(PATIENT_NAV, locale, t);

  const [appts,    setAppts]   = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);
  const [upcoming, setUpcoming]= useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any[]>(`/portal/appointments?upcoming=${upcoming}`)
      .then(r => { setAppts(r ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [upcoming]);

  return (
    <DashboardShell navItems={nav} title={t('nav.myappointments')} locale={locale}>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[[true, 'Upcoming'], [false, 'All']].map(([val, label]) => (
          <button key={String(val)} onClick={() => setUpcoming(val as boolean)}
            style={{ padding: '8px 20px', fontSize: 13, background: upcoming === val ? '#185FA5' : '#f0f0f0', color: upcoming === val ? '#fff' : '#555', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      <DataTable
        keyField="id" loading={loading} rows={appts} empty="No appointments found"
        columns={[
          { key: 'scheduled_date', label: t('dash.date'), width: '130px',
            render: r => formatDate(String(r.scheduled_date), locale) },
          { key: 'scheduled_start', label: t('dash.time'), width: '80px',
            render: r => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(r.scheduled_start ?? '').slice(0,5)}</span> },
          { key: 'doctor_name', label: t('dash.doctor'),
            render: r => <strong>{String(r.doctor_name ?? '—')}</strong> },
          { key: 'specialty', label: t('dash.specialty') },
          { key: 'type_name', label: t('dash.type') },
          { key: 'status', label: t('dash.status'), width: '110px',
            render: r => {
              const s = String(r.status);
              const p = s === 'completed' ? 'success' : s === 'cancelled' ? 'danger' : s === 'checked_in' ? 'warning' : 'info';
              return <Badge label={s} preset={p as any} />;
            }},
        ]}
      />
    </DashboardShell>
  );
}
