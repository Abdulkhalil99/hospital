'use client';
import { useEffect, useState } from 'react';
import { useRouter }            from 'next/navigation';
import { DashboardShell }       from '@/components/layout/DashboardShell';
import { DataTable }            from '@/components/layout/DataTable';
import { Badge }                from '@/components/layout/Badge';
import { api }                  from '@/lib/api';
import { useT }                 from '@/lib/i18n';
import { resolveNav, DOCTOR_NAV } from '@/lib/nav';

export default function DoctorEMR({ params: { locale } }: { params: { locale: string } }) {
  const t      = useT(locale);
  const nav    = resolveNav(DOCTOR_NAV, locale, t);
  const router = useRouter();

  const [doctorId,   setDoctorId]   = useState('');
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    api.get<any>('/doctors/me').then(doc => {
      setDoctorId(doc.id);
      return api.get<any[]>(`/emr/doctor/${doc.id}?date=${today}`);
    }).then(enc => { setEncounters(enc ?? []); setLoading(false); })
    .catch(() => setLoading(false));
  }, []);

  async function startEncounter(patientId: string) {
    const enc = await api.post<any>('/emr', {
      patientId, doctorId, encounterType: 'outpatient',
    });
    router.push(`/${locale}/dashboard/doctor/emr/${enc.id}`);
  }

  return (
    <DashboardShell navItems={nav} title={t('nav.emr')} locale={locale}>
      <DataTable
        keyField="id" loading={loading} rows={encounters} empty="No encounters today"
        columns={[
          { key: 'patient_name', label: 'dash.patient', render: r => <strong>{String(r.patient_name ?? '—')}</strong> },
          { key: 'patient_mrn',  label: 'dash.mrn', width: '130px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{String(r.patient_mrn ?? '—')}</span> },
          { key: 'chief_complaint', label: 'Chief complaint',
            render: r => <span style={{ fontSize: 13 }}>{String(r.chief_complaint ?? '—')}</span> },
          { key: 'status', label: 'dash.status', width: '110px',
            render: r => {
              const s = String(r.status);
              return <Badge label={s} preset={s === 'completed' ? 'success' : s === 'in_progress' ? 'warning' : 'info'} />;
            }},
          { key: 'locked_at', label: 'Lock', width: '80px',
            render: r => r.locked_at ? <Badge label="🔒 Locked" preset="gray" /> : <Badge label="Open" preset="success" /> },
          { key: 'action', label: '', width: '100px',
            render: r => (
              <button
                onClick={() => router.push(`/${locale}/dashboard/doctor/emr/${r.id}`)}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                {t('Open')}
              </button>
            )},
        ]}
      />
    </DashboardShell>
  );
}
