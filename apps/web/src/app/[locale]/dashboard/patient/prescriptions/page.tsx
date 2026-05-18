'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, PATIENT_NAV } from '@/lib/nav';

export default function MyPrescriptions({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(PATIENT_NAV, locale, t);

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState('all');

  useEffect(() => {
    api.get<any[]>('/portal/prescriptions')
      .then(r => { setPrescriptions(r ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? prescriptions
    : prescriptions.filter((p: any) => p.status === filter);

  if (loading) return (
    <DashboardShell navItems={nav} title={t('nav.prescriptions')} locale={locale}>
      <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{t('dash.loading')}</div>
    </DashboardShell>
  );

  return (
    <DashboardShell navItems={nav} title={t('nav.prescriptions')} locale={locale}>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['all', t('All')], ['pending', t('pending')], ['dispensed', t('dispensed')], ['cancelled', t('cancelled')]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '7px 16px', fontSize: 12, borderRadius: 7, border: 'none', cursor: 'pointer', background: filter === val ? '#185FA5' : '#f0f0f0', color: filter === val ? '#fff' : '#555' }}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
          <div>{t('No prescriptions found')}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {filtered.map((rx: any, i: number) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{rx.drug_name}</div>
                {rx.generic_name && rx.generic_name !== rx.drug_name && (
                  <div style={{ fontSize: 12, color: '#888' }}>{rx.generic_name}</div>
                )}
              </div>
              <Badge
                label={t(String(rx.status))}
                preset={rx.status === 'dispensed' ? 'success' : rx.status === 'cancelled' ? 'danger' : 'warning'}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              {[
                [t('dash.dose'),      rx.dosage],
                [t('dash.frequency'), rx.frequency],
                [t('dash.route'),     rx.route],
                [t('dash.quantity'),  `${rx.quantity} ${rx.unit}`],
                rx.duration_days ? [t('Duration'), `${rx.duration_days} ${t('days')}`] : null,
              ].filter(Boolean).map(([label, value]: any) => (
                <div key={label} style={{ background: '#f8f9fa', borderRadius: 6, padding: '7px 10px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 1 }}>{label}</div>
                  <div style={{ fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            {rx.instructions && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#78350f' }}>
                📝 {rx.instructions}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 11, color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('dash.doctor')}: {rx.prescribed_by_name}</span>
              <span>{formatDate(rx.encounter_date, locale)}</span>
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
