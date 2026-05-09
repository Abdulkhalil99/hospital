'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function AdminAppointments({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [appts,   setAppts]   = useState<any[]>([]);
  const [date,    setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/appointments?date=${date}&limit=50`)
      .then(r => { setAppts(r.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  const STATUS_PRESET: Record<string, any> = {
    scheduled: 'info', confirmed: 'success', checked_in: 'warning',
    completed: 'success', cancelled: 'danger', no_show: 'gray',
  };

  return (
    <DashboardShell navItems={nav} title="Appointments" locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Appointments for {date}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>
      <DataTable
        keyField="id" loading={loading} rows={appts} empty="No appointments for this date"
        columns={[
          { key: 'scheduled_start', label: 'Time', width: '80px',
            render: r => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(r.scheduled_start ?? '').slice(0,5)}</span> },
          { key: 'patient_name', label: 'Patient', render: r => <strong>{String(r.patient_name ?? '—')}</strong> },
          { key: 'patient_mrn', label: 'MRN', width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{String(r.patient_mrn ?? '—')}</span> },
          { key: 'doctor_name', label: 'Doctor' },
          { key: 'type_name', label: 'Type' },
          { key: 'status', label: 'Status', width: '110px',
            render: r => <Badge label={String(r.status)} preset={STATUS_PRESET[String(r.status)] ?? 'gray'} /> },
        ]}
      />
    </DashboardShell>
  );
}
