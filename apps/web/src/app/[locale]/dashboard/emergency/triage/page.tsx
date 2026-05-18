'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, EMERGENCY_NAV } from '@/lib/nav';

const ESI_COLORS = ['','#991b1b','#ea580c','#ca8a04','#16a34a','#2563eb'];

export default function TriagePage({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(EMERGENCY_NAV, locale, t);
  const esiLabels = ['', t('Immediate — life threat'), t('Emergent — high risk'), t('Urgent — stable'), t('Less urgent'), t('Non-urgent')];

  const [patients, setPatients] = useState<any[]>([]);
  const [search,   setSearch]   = useState('');
  const [msg,      setMsg]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [visitId,  setVisitId]  = useState('');

  const [register, setRegister] = useState({ chiefComplaint: '', arrivalMode: 'walk_in', patientId: '', unknownName: '', unknownAge: '', unknownGender: 'male' });
  const [triage,   setTriage]   = useState({ esiLevel: 3, bpSystolic: '', bpDiastolic: '', pulseBpm: '', o2Saturation: '', gcsScore: '', painScore: '', temperatureC: '', mechanismOfInjury: '' });

  const [step, setStep] = useState<'register'|'triage'>('register');

  useEffect(() => {
    if (!search.trim()) { setPatients([]); return; }
    const t = setTimeout(() =>
      api.get<any>(`/patients?q=${search}&limit=5`).then(r => setPatients(r.data ?? [])), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      const body: any = {
        chiefComplaint: register.chiefComplaint,
        arrivalMode:    register.arrivalMode,
      };
      if (register.patientId) {
        body.patientId = register.patientId;
      } else {
        body.unknownPatientInfo = { name: register.unknownName, ageEstimate: Number(register.unknownAge) || undefined, gender: register.unknownGender };
      }
      const visit = await api.post<any>('/emergency/visits', body);
      setVisitId(visit.id);
      setStep('triage');
      setMsg(`✅ ${t('Patient registered. Now complete triage.')}`);
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
    setLoading(false);
  }

  async function handleTriage(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      const body: any = { visitId, esiLevel: Number(triage.esiLevel) };
      const numFields = ['bpSystolic','bpDiastolic','pulseBpm','o2Saturation','gcsScore','painScore','temperatureC'];
      numFields.forEach(k => { if ((triage as any)[k]) body[k] = Number((triage as any)[k]); });
      if (triage.mechanismOfInjury) body.mechanismOfInjury = triage.mechanismOfInjury;
      await api.post('/emergency/triage', body);
      setMsg(`✅ ${t('Complete triage — ESI {{level}}', { level: triage.esiLevel })}`);
      setStep('register');
      setVisitId('');
      setRegister({ chiefComplaint: '', arrivalMode: 'walk_in', patientId: '', unknownName: '', unknownAge: '', unknownGender: 'male' });
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
    setLoading(false);
  }

  return (
    <DashboardShell navItems={nav} title={t('Emergency Triage')} locale={locale}>
      <div style={{ maxWidth: 700 }}>

        {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}

        {/* Step 1 — Register */}
        {step === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>{t('Step 1 — Register patient')}</div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{t('Search known patient')}</label>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Name, MRN, phone…')} />
                {patients.length > 0 && (
                  <div style={{ border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                    {patients.map((p: any) => (
                      <div key={p.id} onClick={() => { setRegister(r => ({...r, patientId: p.id})); setSearch(`${p.first_name} ${p.last_name} (${p.mrn})`); setPatients([]); }}
                        style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f5f5f5', display: 'flex', gap: 10 }}>
                        <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{p.mrn}</span>
                        <span>{p.first_name} {p.last_name}</span>
                        {p.has_allergies && <span style={{ marginLeft: 'auto', color: '#991b1b', fontSize: 11 }}>⚠ {t('dash.allergy')}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!register.patientId && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14, padding: '14px', background: '#fafafa', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#888', gridColumn: '1/-1' }}>{t('Or register as unknown patient:')}</div>
                  <div><label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('Name (if known)')}</label><input value={register.unknownName} onChange={e => setRegister(p => ({...p,unknownName:e.target.value}))} /></div>
                  <div><label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('Est. age')}</label><input type="number" value={register.unknownAge} onChange={e => setRegister(p => ({...p,unknownAge:e.target.value}))} /></div>
                  <div><label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('dash.gender')}</label>
                    <select value={register.unknownGender} onChange={e => setRegister(p => ({...p,unknownGender:e.target.value}))}>
                      <option value="male">{t('Male')}</option><option value="female">{t('Female')}</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{t('Chief complaint *')}</label>
                <input value={register.chiefComplaint} onChange={e => setRegister(p => ({...p,chiefComplaint:e.target.value}))} required placeholder={t('e.g. chest pain, breathing difficulty')} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{t('dash.arrivalmode')}</label>
                <select value={register.arrivalMode} onChange={e => setRegister(p => ({...p,arrivalMode:e.target.value}))}>
                  {[
                    ['walk_in', t('Walk in')],
                    ['ambulance', t('Ambulance')],
                    ['police', t('Police')],
                    ['transfer', t('Transfer')],
                    ['other', t('Other')],
                  ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>

              <button type="submit" disabled={loading || (!register.patientId && !register.chiefComplaint)}>
                {loading ? t('Registering…') : t('Register patient →')}
              </button>
            </div>
          </form>
        )}

        {/* Step 2 — Triage */}
        {step === 'triage' && (
          <form onSubmit={handleTriage}>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>{t('Step 2 — Assign ESI level')}</div>

              {/* ESI picker */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t('ESI Triage level *')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n} type="button"
                      onClick={() => setTriage(p => ({...p, esiLevel: n}))}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 8, border: `2px solid ${ESI_COLORS[n]}`,
                        background: triage.esiLevel === n ? ESI_COLORS[n] : 'transparent',
                        color:      triage.esiLevel === n ? '#fff' : ESI_COLORS[n],
                        fontSize:   16, fontWeight: 700,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {triage.esiLevel && (
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: ESI_COLORS[triage.esiLevel] }}>
                    ESI {triage.esiLevel}: {esiLabels[triage.esiLevel]}
                  </div>
                )}
              </div>

              {/* Vitals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[['temperatureC', t('Temp (°C)')], ['bpSystolic', t('BP Systolic')], ['bpDiastolic', t('BP Diastolic')], ['pulseBpm', t('emr.pulse')], ['o2Saturation', t('O₂ Sat %')], ['gcsScore', 'GCS'], ['painScore', t('Pain 0-10')]].map(([k,l]) => (
                  <div key={k}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>{l}</label>
                    <input type="number" value={(triage as any)[k]} onChange={e => setTriage(p => ({...p,[k]:e.target.value}))} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>{t('Mechanism of injury')}</label>
                <input value={triage.mechanismOfInjury} onChange={e => setTriage(p => ({...p,mechanismOfInjury:e.target.value}))} placeholder={t('e.g. RTA, fall from height')} />
              </div>

              <button type="submit" disabled={loading} style={{ background: ESI_COLORS[triage.esiLevel], borderColor: ESI_COLORS[triage.esiLevel] }}>
                {loading ? t('dash.loading') : t('Complete triage — ESI {{level}}', { level: triage.esiLevel })}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
