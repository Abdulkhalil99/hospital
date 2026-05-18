'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { useT }            from '@/lib/i18n';
import { resolveNav, DOCTOR_NAV } from '@/lib/nav';

export default function DoctorAppointments({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(DOCTOR_NAV, locale, t);

  const [appts,   setAppts]   = useState<any[]>([]);
  const [date,    setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    api.get<any>('/doctors/me').then(doc =>
      api.get<any>(`/appointments?doctorId=${doc.id}&date=${date}&limit=50`)
    ).then(r => { setAppts(r.data ?? []); setLoading(false); })
    .catch(() => setLoading(false));
  }, [date]);

  return (
    <DashboardShell navItems={nav} title={t('nav.appointments')} locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t('Appointments for {{date}}', { date })}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>
      <DataTable
        keyField="id" loading={loading} rows={appts} empty={t('No appointments for this date')}
        columns={[
          { key: 'scheduled_start', label: t('dash.time'), width: '80px',
            render: r => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(r.scheduled_start ?? '').slice(0,5)}</span> },
          { key: 'patient_name', label: t('dash.patient'), render: r => <strong>{String(r.patient_name ?? '—')}</strong> },
          { key: 'patient_mrn',  label: t('dash.mrn'), width: '130px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{String(r.patient_mrn ?? '—')}</span> },
          { key: 'type_name', label: t('dash.type') },
          { key: 'status', label: t('dash.status'), width: '110px',
            render: r => {
              const s = String(r.status);
              const p = s === 'completed' ? 'success' : s === 'cancelled' ? 'danger' : s === 'checked_in' ? 'warning' : 'info';
              return <Badge label={t(s)} preset={p as any} />;
            }},
          { key: 'notes', label: t('dash.notes'),
            render: r => <span style={{ fontSize: 12, color: '#888' }}>{String(r.notes ?? '—')}</span> },
        ]}
      />
    </DashboardShell>
  );
}
