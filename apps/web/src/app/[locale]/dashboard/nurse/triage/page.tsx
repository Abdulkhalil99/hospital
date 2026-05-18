'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { resolveNav, NURSE_NAV } from '@/lib/nav';

const ESI_COLORS = ['', '#991b1b', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(NURSE_NAV, locale, t);
  const esiLabels = ['', t('Immediate'), t('Emergent'), t('Urgent'), t('Less urgent'), t('Non-urgent')];

  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [visitId, setVisitId] = useState('');
  const [step, setStep] = useState<'register' | 'triage'>('register');

  const [register, setRegister] = useState({
    patientId: '',
    chiefComplaint: '',
    arrivalMode: 'walk_in',
    unknownName: '',
    unknownAge: '',
    unknownGender: 'male',
  });

  const [triage, setTriage] = useState({
    esiLevel: 3,
    temperatureC: '',
    bpSystolic: '',
    bpDiastolic: '',
    pulseBpm: '',
    respiratoryRate: '',
    o2Saturation: '',
    gcsScore: '',
    painScore: '',
    mechanismOfInjury: '',
    allergiesNoted: '',
    medicationsNoted: '',
    triageNotes: '',
  });

  useEffect(() => {
    if (!search.trim()) {
      setPatients([]);
      return;
    }
    const timeout = setTimeout(() => {
      api.get<any>(`/patients?q=${search}&limit=5`)
        .then((res) => setPatients(res.data ?? []))
        .catch(() => setPatients([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const body: any = {
        chiefComplaint: register.chiefComplaint,
        arrivalMode: register.arrivalMode,
      };
      if (register.patientId) {
        body.patientId = register.patientId;
      } else {
        body.unknownPatientInfo = {
          ...(register.unknownName ? { name: register.unknownName } : {}),
          ...(register.unknownAge ? { ageEstimate: Number(register.unknownAge) } : {}),
          ...(register.unknownGender ? { gender: register.unknownGender } : {}),
        };
      }

      const visit = await api.post<any>('/emergency/visits', body);
      setVisitId(String(visit.id));
      setStep('triage');
      setMsg(t('Patient registered. Continue with triage assessment.'));
    } catch (err: any) {
      setMsg(err.message ?? t('Failed to register patient.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleTriage(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const body: any = {
        visitId,
        esiLevel: Number(triage.esiLevel),
      };
      const numericFields = [
        'temperatureC',
        'bpSystolic',
        'bpDiastolic',
        'pulseBpm',
        'respiratoryRate',
        'o2Saturation',
        'gcsScore',
        'painScore',
      ];

      numericFields.forEach((field) => {
        if ((triage as any)[field] !== '') {
          body[field] = Number((triage as any)[field]);
        }
      });

      if (triage.mechanismOfInjury) body.mechanismOfInjury = triage.mechanismOfInjury;
      if (triage.allergiesNoted) body.allergiesNoted = triage.allergiesNoted;
      if (triage.medicationsNoted) body.medicationsNoted = triage.medicationsNoted;
      if (triage.triageNotes) body.triageNotes = triage.triageNotes;

      await api.post('/emergency/triage', body);
      setMsg(`Triage completed at ESI ${triage.esiLevel}.`);
      setStep('register');
      setVisitId('');
      setRegister({
        patientId: '',
        chiefComplaint: '',
        arrivalMode: 'walk_in',
        unknownName: '',
        unknownAge: '',
        unknownGender: 'male',
      });
      setTriage({
        esiLevel: 3,
        temperatureC: '',
        bpSystolic: '',
        bpDiastolic: '',
        pulseBpm: '',
        respiratoryRate: '',
        o2Saturation: '',
        gcsScore: '',
        painScore: '',
        mechanismOfInjury: '',
        allergiesNoted: '',
        medicationsNoted: '',
        triageNotes: '',
      });
      setSearch('');
      setPatients([]);
    } catch (err: any) {
      setMsg(err.message ?? t('Failed to complete triage.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell navItems={nav} title={t('nav.triage')} locale={locale}>
      <div style={{ maxWidth: 780 }}>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 18px', marginBottom: 18, fontSize: 13, color: '#1e3a8a' }}>
          {t('This nurse triage flow covers rapid ED intake: patient registration, severity assignment, and first-set vitals for emergency routing.')}
        </div>

        {msg && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            background: msg.toLowerCase().includes('failed') ? '#fef2f2' : '#f0fdf4',
            color: msg.toLowerCase().includes('failed') ? '#991b1b' : '#166534',
          }}>
            {msg}
          </div>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>{t('Step 1 — Register emergency visit')}</div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{t('Search existing patient')}</label>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Name, MRN, or phone...')} />
                {patients.length > 0 && (
                  <div style={{ border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                    {patients.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => {
                          setRegister((prev) => ({ ...prev, patientId: patient.id }));
                          setSearch(`${patient.first_name} ${patient.last_name} (${patient.mrn})`);
                          setPatients([]);
                        }}
                        style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f5f5f5', display: 'flex', gap: 10 }}
                      >
                        <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{patient.mrn}</span>
                        <span>{patient.first_name} {patient.last_name}</span>
                        {patient.has_allergies && <span style={{ marginLeft: 'auto', color: '#991b1b', fontSize: 11 }}>{t('dash.allergy')}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!register.patientId && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14, padding: 14, background: '#fafafa', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', gridColumn: '1/-1' }}>{t('Or register as an unknown emergency patient.')}</div>
                  <div>
                    <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('dash.name')}</label>
                    <input value={register.unknownName} onChange={(e) => setRegister((prev) => ({ ...prev, unknownName: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('Estimated age')}</label>
                    <input type="number" value={register.unknownAge} onChange={(e) => setRegister((prev) => ({ ...prev, unknownAge: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('dash.gender')}</label>
                    <select value={register.unknownGender} onChange={(e) => setRegister((prev) => ({ ...prev, unknownGender: e.target.value }))}>
                      <option value="male">{t('Male')}</option>
                      <option value="female">{t('Female')}</option>
                      <option value="other">{t('Other')}</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{t('Chief complaint *')}</label>
                <input value={register.chiefComplaint} onChange={(e) => setRegister((prev) => ({ ...prev, chiefComplaint: e.target.value }))} required placeholder={t('e.g. chest pain, breathing difficulty')} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{t('dash.arrivalmode')}</label>
                <select value={register.arrivalMode} onChange={(e) => setRegister((prev) => ({ ...prev, arrivalMode: e.target.value }))}>
                  <option value="walk_in">{t('Walk in')}</option>
                  <option value="ambulance">{t('Ambulance')}</option>
                  <option value="police">{t('Police')}</option>
                  <option value="transfer">{t('Transfer')}</option>
                  <option value="other">{t('Other')}</option>
                </select>
              </div>

              <button type="submit" disabled={loading || !register.chiefComplaint.trim()}>
                {loading ? t('Registering…') : t('Continue to triage')}
              </button>
            </div>
          </form>
        )}

        {step === 'triage' && (
          <form onSubmit={handleTriage}>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>{t('Step 2 — Triage assessment')}</div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t('ESI severity level *')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setTriage((prev) => ({ ...prev, esiLevel: level }))}
                      style={{
                        flex: 1,
                        padding: '12px 0',
                        borderRadius: 8,
                        border: `2px solid ${ESI_COLORS[level]}`,
                        background: triage.esiLevel === level ? ESI_COLORS[level] : 'transparent',
                        color: triage.esiLevel === level ? '#fff' : ESI_COLORS[level],
                        fontSize: 16,
                        fontWeight: 700,
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: ESI_COLORS[triage.esiLevel] }}>
                  ESI {triage.esiLevel}: {esiLabels[triage.esiLevel]}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  ['temperatureC', t('Temp (°C)')],
                  ['bpSystolic', t('BP systolic')],
                  ['bpDiastolic', t('BP diastolic')],
                  ['pulseBpm', t('emr.pulse')],
                  ['respiratoryRate', t('Resp. rate')],
                  ['o2Saturation', t('O2 sat %')],
                  ['gcsScore', 'GCS'],
                  ['painScore', t('Pain 0-10')],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>{label}</label>
                    <input type="number" value={(triage as any)[key]} onChange={(e) => setTriage((prev) => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
                <input value={triage.mechanismOfInjury} onChange={(e) => setTriage((prev) => ({ ...prev, mechanismOfInjury: e.target.value }))} placeholder={t('Mechanism of injury (optional)')} />
                <input value={triage.allergiesNoted} onChange={(e) => setTriage((prev) => ({ ...prev, allergiesNoted: e.target.value }))} placeholder={t('Known allergies (optional)')} />
                <input value={triage.medicationsNoted} onChange={(e) => setTriage((prev) => ({ ...prev, medicationsNoted: e.target.value }))} placeholder={t('Current medications (optional)')} />
                <textarea rows={3} value={triage.triageNotes} onChange={(e) => setTriage((prev) => ({ ...prev, triageNotes: e.target.value }))} placeholder={t('Triage notes...')} />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ background: ESI_COLORS[triage.esiLevel], borderColor: ESI_COLORS[triage.esiLevel] }}
              >
                {loading ? t('dash.loading') : t('Complete triage — ESI {{level}}', { level: triage.esiLevel })}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
