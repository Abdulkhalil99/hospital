'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate, isRTL } from '@/lib/i18n';
import { resolveNav, PATIENT_NAV }  from '@/lib/nav';

export default function PatientPortal({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const rtl = isRTL(locale);
  const nav = resolveNav(PATIENT_NAV, locale, t);

  const [profile,  setProfile]  = useState<any>(null);
  const [summary,  setSummary]  = useState<any>(null);
  const [allergies,setAllergies]= useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [linked,   setLinked]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>('/portal/profile').catch(() => null),
      api.get<any>('/portal/summary').catch(() => null),
      api.get<any[]>('/portal/allergies').catch(() => []),
    ]).then(([p, s, a]) => {
      if (!p) setLinked(false);
      setProfile(p); setSummary(s); setAllergies(a ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <DashboardShell navItems={nav} title={t('nav.myhealthcare')} locale={locale}>
      <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>{t('dash.loading')}</div>
    </DashboardShell>
  );

  if (!linked) return (
    <DashboardShell navItems={nav} title={t('nav.myhealthcare')} locale={locale}>
      <LinkPatientCard locale={locale} t={t} onLinked={() => window.location.reload()} />
    </DashboardShell>
  );

  const age = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400000))
    : null;

  return (
    <DashboardShell navItems={nav} title={t('nav.myhealthcare')} locale={locale}>

      {/* Profile hero */}
      <div style={{
        background: 'linear-gradient(135deg, #185FA5, #0F6E56)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 20, color: '#fff',
      }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
          {profile?.gender === 'female' ? '👩' : '👤'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {profile?.first_name} {profile?.last_name}
          </div>
          <div style={{ fontSize: 13, opacity: .85 }}>
            MRN: <strong>{profile?.mrn}</strong>
            {age && ` · ${age} ${t('patients.years')}`}
            {profile?.blood_type && ` · ${profile.blood_type}`}
          </div>
          <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>
            {profile?.phone} {profile?.email && `· ${profile.email}`}
          </div>
        </div>
        {allergies.length > 0 && (
          <div style={{ background: '#E24B4A', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600 }}>
            ⚠ {allergies.length} {t('patients.allergies')}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label={t('emr.encounters')}    value={Number(profile?.total_visits ?? 0)} icon="📋" color="#185FA5" />
        <StatCard label={t('patients.allergies')} value={allergies.length}                  icon="⚠️" color={allergies.length > 0 ? '#991b1b' : '#888'} />
        <StatCard label="Last visit" value={profile?.last_visit ? formatDate(profile.last_visit, locale) : '—'} icon="📅" color="#0F6E56" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Allergies */}
        {allergies.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #fca5a5', padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b', marginBottom: 12 }}>
              ⚠ {t('patients.allergies')}
            </div>
            {allergies.map((a: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < allergies.length - 1 ? '1px solid #fee2e2' : 'none', fontSize: 13 }}>
                <strong>{a.allergen}</strong>
                <Badge label={a.severity} preset={a.severity === 'life_threatening' || a.severity === 'severe' ? 'danger' : 'warning'} />
              </div>
            ))}
          </div>
        )}

        {/* Recent diagnoses */}
        {summary?.diagnoses?.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent diagnoses</div>
            {summary.diagnoses.slice(0, 5).map((d: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: i < 4 ? '1px solid #f5f5f5' : 'none', fontSize: 13 }}>
                <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600, flexShrink: 0 }}>{d.icd10_code}</span>
                <span style={{ color: '#555' }}>{d.icd10_name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent vitals */}
        {summary?.recentVitals?.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Latest vitals</div>
            {(() => {
              const v = summary.recentVitals[0];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    [`${t('emr.bloodPressure')}`, v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic} mmHg` : '—'],
                    [`${t('emr.pulse')}`,          v.pulse_bpm       ? `${v.pulse_bpm} bpm`   : '—'],
                    [`${t('emr.temperature')}`,    v.temperature_c   ? `${v.temperature_c}°C`  : '—'],
                    [`${t('emr.oxygen')}`,         v.o2_saturation   ? `${v.o2_saturation}%`   : '—'],
                    [`${t('emr.weight')}`,         v.weight_kg       ? `${v.weight_kg} kg`     : '—'],
                    [`${t('emr.bmi')}`,            v.bmi             ? v.bmi                   : '—'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>{value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Recent encounters */}
        {summary?.recentEncounters?.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent visits</div>
            {summary.recentEncounters.map((e: any, i: number) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < summary.recentEncounters.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <strong>{e.doctor_name}</strong>
                  <span style={{ fontSize: 12, color: '#888' }}>{formatDate(e.started_at, locale)}</span>
                </div>
                {e.chief_complaint && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{e.chief_complaint}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function LinkPatientCard({ locale, t, onLinked }: { locale: string; t: (k: string) => string; onLinked: () => void }) {
  const [patientId, setPatientId] = useState('');
  const [msg,       setMsg]       = useState('');
  const [loading,   setLoading]   = useState(false);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      await api.post('/portal/link-patient', { patientId });
      setMsg('✅ Patient record linked successfully');
      setTimeout(onLinked, 1500);
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', background: '#fff', borderRadius: 14, border: '1px solid #e8e8e8', padding: '32px 28px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔗</div>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Link your patient record</div>
        <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
          Enter your patient ID to connect your medical records to this portal account.
          Ask the receptionist for your patient ID.
        </div>
      </div>
      <form onSubmit={handleLink}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Patient ID</label>
          <input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="Your patient UUID" required />
        </div>
        {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? t('dash.loading') : 'Link my record'}
        </button>
      </form>
    </div>
  );
}
