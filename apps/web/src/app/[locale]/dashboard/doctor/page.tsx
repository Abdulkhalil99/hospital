'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }       from '@/components/layout/DashboardShell';
import { StatCard }             from '@/components/layout/StatCard';
import { DataTable }            from '@/components/layout/DataTable';
import { Badge }                from '@/components/layout/Badge';
import { api }                  from '@/lib/api';
import { useT }                 from '@/lib/i18n';
import { resolveNav, DOCTOR_NAV } from '@/lib/nav';

export default function DoctorDashboard({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(DOCTOR_NAV, locale, t);

  const [queue,    setQueue]    = useState<any[]>([]);
  const [appts,    setAppts]    = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [loading,  setLoading]  = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    api.get<any>('/doctors/me').then(doc => {
      setDoctorId(doc.id);
      return Promise.all([
        api.get<any>(`/appointments/queue/${doc.id}`),
        api.get<any>(`/appointments?doctorId=${doc.id}&date=${today}&limit=20`),
      ]);
    }).then(([q, a]) => {
      setQueue(q.tokens ?? []); setAppts(a.data ?? []); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const waiting   = queue.filter((t: any) => t.status === 'waiting').length;
  const called    = queue.find((t: any)   => t.status === 'called');
  const completed = queue.filter((t: any) => t.status === 'completed').length;

  async function callNext() {
    if (!doctorId) return;
    await api.post(`/appointments/queue/${doctorId}/call-next`, {});
    const q = await api.get<any>(`/appointments/queue/${doctorId}`);
    setQueue(q.tokens ?? []);
  }

  return (
    <DashboardShell navItems={nav} title={t('nav.queue')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label={t('dash.waiting')}    value={waiting}                     icon="⏳" color="#854F0B" />
        <StatCard label={t('nav.appointments')}value={appts.length}                icon="📅" color="#185FA5" />
        <StatCard label={t('dash.completed')}  value={completed}                   icon="✅" color="#0F6E56" />
        <StatCard label={t('dash.active')}     value={called?.display ?? '—'}      icon="📢" color="#991b1b" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t('nav.queue')}</div>
        <button onClick={callNext} style={{ fontSize: 13, padding: '7px 18px' }}>
          📢 {t('dash.callnext')}
        </button>
      </div>

      {called && (
        <div style={{ background: '#e1f5ee', border: '1px solid #5DCAA5', borderRadius: 10, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#085041' }}>{called.display}</span>
          <div>
            <div style={{ fontWeight: 600, color: '#085041' }}>{called.patient_name ?? called.patientName}</div>
          </div>
          <button onClick={async () => {
            await api.post(`/appointments/queue/tokens/${called.id}/complete`, {});
            const q = await api.get<any>(`/appointments/queue/${doctorId}`);
            setQueue(q.tokens ?? []);
          }} style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 14px', background: '#0F6E56' }}>
            ✓ {t('dash.complete')}
          </button>
        </div>
      )}

      <DataTable
        keyField="id" loading={loading} rows={queue} empty={t('dash.nodata')}
        columns={[
          { key: 'display',      label: '#', width: '70px',
            render: r => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#185FA5' }}>{String(r.display ?? r.token_display)}</span> },
          { key: 'patient_name', label: t('dash.patient'), render: r => String(r.patient_name ?? r.patientName ?? '—') },
          { key: 'patient_mrn',  label: t('dash.mrn'), width: '120px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{String(r.patient_mrn ?? r.patientMrn ?? '—')}</span> },
          { key: 'status', label: t('dash.status'), width: '100px',
            render: r => {
              const s = String(r.status);
              return <Badge label={t(s)} preset={s === 'called' ? 'success' : s === 'waiting' ? 'warning' : 'gray'} />;
            }},
        ]}
      />
    </DashboardShell>
  );
}
