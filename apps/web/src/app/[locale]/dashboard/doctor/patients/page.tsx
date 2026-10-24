'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';
import { useT, formatDate } from '@/lib/i18n';
import { resolveNav, DOCTOR_NAV } from '@/lib/nav';

export default function DoctorPatients({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(DOCTOR_NAV, locale, t);
  const router = useRouter();

  const [patients, setPatients] = useState<any[]>([]);
  const [q,        setQ]        = useState('');
  const [loading,  setLoading]  = useState(false);
  const [starting, setStarting] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<any>(`/patients?q=${encodeURIComponent(q)}&limit=30`)
      .then(r => { if (active) setPatients(r.data ?? []); })
      .catch((err: Error) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [q]);

  async function startEncounter(patientId: string) {
    if (starting) return;
    setStarting(patientId);
    setError('');
    try {
      const doctor = await api.get<{ id: string }>('/doctors/me');
      const today = new Date().toISOString().split('T')[0];
      const encounters = await api.get<any[]>(`/emr/doctor/${doctor.id}?date=${today}`);
      const existing = encounters.find(encounter => encounter.patient_id === patientId && encounter.status === 'in_progress' && !encounter.locked_at);
      const encounter = existing ?? await api.post<{ id: string }>('/emr', {
        patientId, doctorId: doctor.id, encounterType: 'outpatient',
      });
      router.push(`/${locale}/dashboard/doctor/emr/${encounter.id}`);
    } catch (err: any) {
      setError(err.message);
      setStarting('');
    }
  }

  return (
    <DashboardShell navItems={nav} title={t('nav.patients')} locale={locale}>
      {error && <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>{t(error)}</div>}
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
          { key: 'action', label: '', width: '150px', render: r => (
            <button onClick={() => startEncounter(String(r.id))} disabled={!!starting} style={{ fontSize: 12, padding: '6px 12px' }}>
              {t(starting === r.id ? 'dash.loading' : 'emr.newEncounter')}
            </button>
          ) },
        ]}
      />
    </DashboardShell>
  );
}
