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
  const [msg,      setMsg]     = useState('');
  const [cancellingId, setCancellingId] = useState('');

  async function loadAppointments(nextUpcoming = upcoming) {
    setLoading(true);
    api.get<any[]>(`/portal/appointments?upcoming=${nextUpcoming}`)
      .then(r => { setAppts(r ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadAppointments(upcoming);
  }, [upcoming]);

  async function cancelAppointment(appointmentId: string) {
    const reason = window.prompt(t('Please enter a reason for cancellation:'));
    if (!reason || !reason.trim()) return;

    setCancellingId(appointmentId);
    setMsg('');
    try {
      await api.post(`/portal/appointments/${appointmentId}/cancel`, { reason: reason.trim() });
      setMsg(`✅ ${t('Appointment cancelled successfully.')}`);
      await loadAppointments(upcoming);
    } catch (err: any) {
      setMsg(`❌ ${err.message ?? t('Failed to cancel appointment.')}`);
    } finally {
      setCancellingId('');
    }
  }

  return (
    <DashboardShell navItems={nav} title={t('nav.myappointments')} locale={locale}>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[[true, t('Upcoming')], [false, t('All')]].map(([val, label]) => (
          <button key={String(val)} onClick={() => setUpcoming(val as boolean)}
            style={{ padding: '8px 20px', fontSize: 13, background: upcoming === val ? '#185FA5' : '#f0f0f0', color: upcoming === val ? '#fff' : '#555', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          color: msg.startsWith('✅') ? '#166534' : '#991b1b',
        }}>
          {msg}
        </div>
      )}

      <DataTable
        keyField="id" loading={loading} rows={appts} empty={t('dash.nodata')}
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
              return <Badge label={t(s)} preset={p as any} />;
            }},
          { key: 'action', label: '', width: '130px',
            render: r => {
              const cancellable = ['scheduled', 'confirmed'].includes(String(r.status));
              if (!cancellable) return <span style={{ color: '#aaa', fontSize: 12 }}>—</span>;
              return (
                <button
                  onClick={() => cancelAppointment(String(r.id))}
                  disabled={cancellingId === r.id}
                  style={{ fontSize: 12, padding: '5px 12px', background: '#fef2f2', color: '#991b1b' }}
                >
                  {cancellingId === r.id ? t('Cancelling…') : t('dash.cancel')}
                </button>
              );
            } },
        ]}
      />
    </DashboardShell>
  );
}
