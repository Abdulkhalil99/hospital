'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';

const NAV = [
  { label: 'Worklist',        icon: '🧪', path: '/dashboard/lab' },
  { label: 'Enter results',   icon: '✏️', path: '/dashboard/lab/results' },
  { label: 'Critical alerts', icon: '🚨', path: '/dashboard/lab/critical' },
  { label: 'Test catalog',    icon: '📋', path: '/dashboard/lab/catalog' },
];

export default function LabResults({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = NAV.map(n => ({ ...n, path: `/${locale}${n.path}` }));

  const [barcode,  setBarcode]  = useState('');
  const [sample,   setSample]   = useState<any>(null);
  const [components, setComponents] = useState([{ componentName: '', resultValue: '', unit: '' }]);
  const [msg,      setMsg]      = useState('');
  const [saving,   setSaving]   = useState(false);
  const [step,     setStep]     = useState<'scan'|'receive'|'enter'|'validate'>('scan');

  async function receiveSample() {
    if (!barcode.trim()) return;
    try {
      const s = await api.post<any>('/laboratory/samples/receive', { barcode });
      setSample(s); setStep('enter');
      setMsg(`✅ ${t('Sample received')}`);
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
  }

  async function submitResults() {
    setSaving(true); setMsg('');
    try {
      const validComponents = components.filter(c => c.componentName && c.resultValue);
      await api.post('/laboratory/results', { sampleId: sample.id, components: validComponents });
      setMsg(`✅ ${t('Results saved. Pending validation.')}`);
      setStep('validate');
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
    setSaving(false);
  }

  function addRow()    { setComponents(p => [...p, { componentName: '', resultValue: '', unit: '' }]); }
  function removeRow(i: number) { setComponents(p => p.filter((_, idx) => idx !== i)); }

  return (
    <DashboardShell navItems={nav} title="Enter Lab Results" locale={locale}>
      <div style={{ maxWidth: 700 }}>

        {/* Step 1 — Scan */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('Step 1 — Scan or enter barcode')}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={barcode} onChange={e => setBarcode(e.target.value)} onKeyDown={e => e.key === 'Enter' && receiveSample()} placeholder={t('e.g. LAB-20240115-0001')} style={{ flex: 1 }} />
            <button onClick={receiveSample} style={{ flexShrink: 0 }}>{t('Receive sample')}</button>
          </div>
        </div>

        {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}

        {/* Step 2 — Sample info */}
        {sample && (
          <div style={{ background: '#f0f7ff', borderRadius: 10, border: '1px solid #cce3f9', padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#185FA5', marginBottom: 6 }}>{t('Sample')}: {sample.barcode}</div>
            <div style={{ fontSize: 13, color: '#555' }}>
              {t('dash.patient')}: <strong>{sample.patient_name}</strong> ({sample.patient_mrn}) ·
              {t('Test')}: <strong>{sample.test_name}</strong> ·
              {t('dash.type')}: {sample.sample_type} ·
              <Badge label={String(sample.urgency ?? 'routine').toUpperCase()} preset={sample.urgency === 'stat' ? 'danger' : 'info'} />
            </div>
          </div>
        )}

        {/* Step 3 — Enter results */}
        {step === 'enter' && sample && (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{t('Step 2 — Enter results')}</div>

            {components.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input value={c.componentName} onChange={e => setComponents(p => p.map((r,idx) => idx===i ? {...r,componentName:e.target.value} : r))} placeholder={t('Component (e.g. Haemoglobin)')} />
                <input value={c.resultValue}   onChange={e => setComponents(p => p.map((r,idx) => idx===i ? {...r,resultValue:e.target.value}   : r))} placeholder={t('Result (e.g. 13.5)')} />
                <input value={c.unit}          onChange={e => setComponents(p => p.map((r,idx) => idx===i ? {...r,unit:e.target.value}          : r))} placeholder={t('Unit (e.g. g/dL)')} />
                <button type="button" onClick={() => removeRow(i)} style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 10px', fontSize: 16 }}>×</button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={addRow} style={{ background: '#f0f0f0', color: '#333' }}>+ {t('Add component')}</button>
              <button onClick={submitResults} disabled={saving}>{saving ? t('Saving…') : t('Submit results')}</button>
            </div>
          </div>
        )}

        {step === 'validate' && (
          <div style={{ background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', padding: '20px 22px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 6 }}>{t('Results submitted')}</div>
            <div style={{ fontSize: 13, color: '#15803d' }}>{t('Results are pending validation by a supervisor. The ordering doctor will be notified when validated.')}</div>
            <button onClick={() => { setBarcode(''); setSample(null); setComponents([{componentName:'',resultValue:'',unit:''}]); setStep('scan'); setMsg(''); }} style={{ marginTop: 14, background: '#166534' }}>
              {t('Process next sample')}
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
