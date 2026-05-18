'use client';
import { useEffect, useState } from 'react';
import { useRouter }            from 'next/navigation';
import { api }                  from '@/lib/api';
import { useT }                 from '@/lib/i18n';

interface Props { params: { locale: string; encounterId: string } }

export default function EncounterDetail({ params: { locale, encounterId } }: Props) {
  const router = useRouter();
  const t = useT(locale);
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [tab,     setTab]     = useState<'soap'|'vitals'|'diagnoses'|'prescriptions'|'lab'>('soap');

  const [soap,    setSoap]    = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [vitals,  setVitals]  = useState({ temperatureC: '', bpSystolic: '', bpDiastolic: '', pulseBpm: '', o2Saturation: '', weightKg: '' });
  const [dx,      setDx]      = useState({ icd10Code: '', icd10Name: '', diagnosisType: 'primary' });
  const [rx,      setRx]      = useState({ drugName: '', dosage: '', frequency: '', route: 'oral', durationDays: '', quantity: '', unit: 'tablet', instructions: '' });
  const [lab,     setLab]     = useState({ testName: '', testCode: '', urgency: 'routine' });

  useEffect(() => {
    api.get<any>(`/emr/${encounterId}/full`)
      .then(d => {
        setData(d);
        const note = d.notes?.find((n: any) => n.note_type === 'soap');
        if (note) setSoap({ subjective: note.subjective ?? '', objective: note.objective ?? '', assessment: note.assessment ?? '', plan: note.plan ?? '' });
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [encounterId]);

  const locked = !!data?.encounter?.locked_at;

  async function saveSoap() {
    setSaving(true); setMsg('');
    try {
      await api.post(`/emr/${encounterId}/notes`, { noteType: 'soap', ...soap });
      setMsg(`✅ ${t('SOAP note saved')}`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setSaving(false);
  }

  async function saveVitals() {
    setSaving(true); setMsg('');
    try {
      const body = Object.fromEntries(
        Object.entries(vitals).filter(([,v]) => v !== '').map(([k,v]) => [k, Number(v)])
      );
      await api.post(`/emr/${encounterId}/vitals`, body);
      setMsg(`✅ ${t('Vitals saved')}`);
      const d = await api.get<any>(`/emr/${encounterId}/full`);
      setData(d);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setSaving(false);
  }

  async function addDiagnosis() {
    setSaving(true); setMsg('');
    try {
      await api.post(`/emr/${encounterId}/diagnoses`, dx);
      setMsg(`✅ ${t('Diagnosis added')}`);
      const d = await api.get<any>(`/emr/${encounterId}/full`);
      setData(d);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setSaving(false);
  }

  async function addPrescription() {
    setSaving(true); setMsg('');
    try {
      await api.post(`/emr/${encounterId}/prescriptions`, {
        ...rx, quantity: Number(rx.quantity), durationDays: Number(rx.durationDays) || undefined,
      });
      setMsg(`✅ ${t('Prescription added')}`);
      const d = await api.get<any>(`/emr/${encounterId}/full`);
      setData(d);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setSaving(false);
  }

  async function addLabOrder() {
    setSaving(true); setMsg('');
    try {
      await api.post(`/emr/${encounterId}/lab-orders`, lab);
      setMsg(`✅ ${t('Lab order added')}`);
      const d = await api.get<any>(`/emr/${encounterId}/full`);
      setData(d);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setSaving(false);
  }

  async function completeEncounter() {
    if (!confirm(t('Mark this encounter as complete?'))) return;
    await api.post(`/emr/${encounterId}/complete`, {});
    router.push(`/${locale}/dashboard/doctor/emr`);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{t('dash.loading')}</div>;
  if (!data)   return <div style={{ padding: 40, color: '#888' }}>{t('Encounter not found')}</div>;

  const enc = data.encounter;

  const TABS = ['soap','vitals','diagnoses','prescriptions','lab'] as const;
  const LABELS = [t('SOAP Note'), t('nav.vitals'), t('emr.diagnoses'), t('emr.prescriptions'), t('emr.labOrders')];

  const fieldStyle = { marginBottom: 12 } as const;
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#555' } as const;
  const grid2      = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as const;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 28px' }}>
      {/* Back */}
      <button onClick={() => router.back()} style={{ background: 'none', color: '#185FA5', border: 'none', padding: 0, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
        ← {t('back')}
      </button>

      {/* Header */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '18px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{enc.patient_name}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{t('dash.mrn')}: {enc.patient_mrn} · {enc.encounter_type} · {new Date(enc.started_at).toLocaleString()}</div>
          {enc.chief_complaint && <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{t('emr.chiefComplaint')}: <strong>{enc.chief_complaint}</strong></div>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {locked && <span style={{ fontSize: 12, background: '#f5f5f5', color: '#888', padding: '4px 10px', borderRadius: 6 }}>🔒 {t('emr.locked')}</span>}
          {!locked && enc.status !== 'completed' && (
            <button onClick={completeEncounter} style={{ background: '#0F6E56', fontSize: 13 }}>
              ✓ {t('Complete encounter')}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: 6 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 0', fontSize: 13, borderRadius: 7,
            background: tab === t ? '#185FA5' : 'transparent',
            color:      tab === t ? '#fff' : '#555',
            border: 'none', fontWeight: tab === t ? 600 : 400,
          }}>
            {LABELS[i]}
            {t === 'diagnoses'    && data.diagnoses?.length    > 0 && <span style={{ marginLeft: 6, background: '#fff3', borderRadius: 10, padding: '0 5px', fontSize: 11 }}>{data.diagnoses.length}</span>}
            {t === 'prescriptions'&& data.prescriptions?.length > 0 && <span style={{ marginLeft: 6, background: '#fff3', borderRadius: 10, padding: '0 5px', fontSize: 11 }}>{data.prescriptions.length}</span>}
          </button>
        ))}
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}

      {/* SOAP */}
      {tab === 'soap' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {(['subjective','objective','assessment','plan'] as const).map((k, i) => {
            const LABELS2 = [
              t('S — Subjective (patient says)'),
              t('O — Objective (you observe)'),
              t('A — Assessment (diagnosis)'),
              t('P — Plan (treatment)'),
            ];
            const COLORS = ['#E6F1FB','#E1F5EE','#FAEEDA','#EEEDFE'];
            const BORDERS = ['#85B7EB','#5DCAA5','#EF9F27','#AFA9EC'];
            return (
              <div key={k} style={{ border: `1px solid ${BORDERS[i]}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: COLORS[i], padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>{LABELS2[i]}</div>
                <textarea
                  value={soap[k]}
                  onChange={e => setSoap(p => ({ ...p, [k]: e.target.value }))}
                  disabled={locked}
                  rows={6}
                  style={{ width: '100%', border: 'none', padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', background: locked ? '#fafafa' : '#fff' }}
                  placeholder={t('Enter {{section}} notes…', { section: k })}
                />
              </div>
            );
          })}
          {!locked && (
            <div style={{ gridColumn: '1/-1' }}>
              <button onClick={saveSoap} disabled={saving}>{saving ? t('Saving…') : t('Save SOAP note')}</button>
            </div>
          )}
        </div>
      )}

      {/* Vitals */}
      {tab === 'vitals' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          {data.vitals?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Previous vitals')}</div>
              {data.vitals.slice(0,3).map((v: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#555', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                  {new Date(v.recorded_at).toLocaleString()} — T:{v.temperature_c}°C BP:{v.bp_systolic}/{v.bp_diastolic} HR:{v.pulse_bpm} O2:{v.o2_saturation}% BMI:{v.bmi}
                </div>
              ))}
            </div>
          )}
          {!locked && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t('Record new vitals')}</div>
              <div style={grid2}>
                {[['temperatureC','Temperature (°C)'],['bpSystolic','BP Systolic'],['bpDiastolic','BP Diastolic'],['pulseBpm','Pulse (bpm)'],['o2Saturation','O₂ Saturation (%)'],['weightKg','Weight (kg)']].map(([k,l]) => (
                  <div key={k} style={fieldStyle}>
                    <label style={labelStyle}>{t(l)}</label>
                    <input type="number" value={(vitals as any)[k]} onChange={e => setVitals(p => ({ ...p, [k]: e.target.value }))} placeholder="—" />
                  </div>
                ))}
              </div>
              <button onClick={saveVitals} disabled={saving}>{saving ? t('Saving…') : t('Save vitals')}</button>
            </>
          )}
        </div>
      )}

      {/* Diagnoses */}
      {tab === 'diagnoses' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          {data.diagnoses?.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
              <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{d.icd10_code}</span>
              <span style={{ flex: 1 }}>{d.icd10_name}</span>
              <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4 }}>{d.diagnosis_type}</span>
            </div>
          ))}
          {!locked && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t('Add diagnosis')}</div>
              <div style={grid2}>
                <div style={fieldStyle}><label style={labelStyle}>{t('ICD-10 Code *')}</label><input value={dx.icd10Code} onChange={e => setDx(p => ({...p, icd10Code: e.target.value}))} placeholder={t('e.g. J06.9')} /></div>
                <div style={fieldStyle}><label style={labelStyle}>{t('Diagnosis name *')}</label><input value={dx.icd10Name} onChange={e => setDx(p => ({...p, icd10Name: e.target.value}))} placeholder={t('e.g. Acute URI')} /></div>
                <div style={fieldStyle}><label style={labelStyle}>{t('dash.type')}</label>
                  <select value={dx.diagnosisType} onChange={e => setDx(p => ({...p, diagnosisType: e.target.value}))}>
                    <option value="primary">{t('Primary')}</option><option value="secondary">{t('Secondary')}</option><option value="differential">{t('Differential')}</option>
                  </select>
                </div>
              </div>
              <button onClick={addDiagnosis} disabled={saving}>{saving ? t('Saving…') : t('Add diagnosis')}</button>
            </div>
          )}
        </div>
      )}

      {/* Prescriptions */}
      {tab === 'prescriptions' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          {data.prescriptions?.map((r: any, i: number) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{r.drug_name} <span style={{ fontWeight: 400, color: '#888' }}>{r.dosage} — {r.frequency}</span></div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Route: {r.route} · {r.duration_days ? `${r.duration_days} days` : ''} · Qty: {r.quantity} {r.unit}</div>
              {r.instructions && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{r.instructions}</div>}
            </div>
          ))}
          {!locked && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t('Add prescription')}</div>
              <div style={grid2}>
                {[['drugName','Drug name *'],['dosage','Dose *'],['frequency','Frequency *'],['quantity','Quantity *'],['unit','Unit'],['durationDays','Duration (days)']].map(([k,l]) => (
                  <div key={k} style={fieldStyle}><label style={labelStyle}>{t(l)}</label>
                    <input value={(rx as any)[k]} onChange={e => setRx(p => ({...p, [k]: e.target.value}))} /></div>
                ))}
                <div style={fieldStyle}><label style={labelStyle}>{t('dash.route')}</label>
                  <select value={rx.route} onChange={e => setRx(p => ({...p, route: e.target.value}))}>
                    {['oral','iv','im','sc','topical','inhaled','other'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ ...fieldStyle, gridColumn: '1/-1' }}><label style={labelStyle}>{t('Instructions')}</label>
                  <input value={rx.instructions} onChange={e => setRx(p => ({...p, instructions: e.target.value}))} placeholder={t('e.g. Take with food')} /></div>
              </div>
              <button onClick={addPrescription} disabled={saving}>{saving ? t('Saving…') : t('Add prescription')}</button>
            </div>
          )}
        </div>
      )}

      {/* Lab orders */}
      {tab === 'lab' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          {data.labOrders?.map((o: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
              <strong>{o.test_name}</strong>
              {o.test_code && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{o.test_code}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 11, background: o.urgency === 'stat' ? '#fef2f2' : '#eff6ff', color: o.urgency === 'stat' ? '#991b1b' : '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{o.urgency.toUpperCase()}</span>
            </div>
          ))}
          {!locked && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t('Order lab test')}</div>
              <div style={grid2}>
                <div style={fieldStyle}><label style={labelStyle}>{t('Test name *')}</label><input value={lab.testName} onChange={e => setLab(p => ({...p, testName: e.target.value}))} placeholder={t('e.g. CBC')} /></div>
                <div style={fieldStyle}><label style={labelStyle}>{t('Test code')}</label><input value={lab.testCode} onChange={e => setLab(p => ({...p, testCode: e.target.value}))} placeholder={t('e.g. CBC')} /></div>
                <div style={fieldStyle}><label style={labelStyle}>{t('dash.urgency')}</label>
                  <select value={lab.urgency} onChange={e => setLab(p => ({...p, urgency: e.target.value}))}>
                    <option value="routine">{t('Routine')}</option><option value="urgent">{t('Urgent')}</option><option value="stat">{t('STAT')}</option>
                  </select>
                </div>
              </div>
              <button onClick={addLabOrder} disabled={saving}>{saving ? t('Saving…') : t('Order test')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
