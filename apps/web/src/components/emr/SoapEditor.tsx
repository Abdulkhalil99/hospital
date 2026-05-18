'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useT } from '@/lib/i18n';

interface SoapData {
  subjective: string;
  objective:  string;
  assessment: string;
  plan:       string;
}
//add some comments for this file

interface SoapEditorProps {
  encounterId: string;
  isLocked?:   boolean;
  initial?:    Partial<SoapData>;
  onSave?:     (data: SoapData) => Promise<void>;
}

const SECTIONS = [
  {
    key: 'subjective' as const,
    letter: 'S',
    label: 'Subjective',
    placeholder: "Patient's chief complaint, history, symptoms in their own words...",
    color: '#E6F1FB', textColor: '#0C447C', borderColor: '#85B7EB',
  },
  {
    key: 'objective' as const,
    letter: 'O',
    label: 'Objective',
    placeholder: 'Examination findings, vital signs, observable measurements...',
    color: '#E1F5EE', textColor: '#085041', borderColor: '#5DCAA5',
  },
  {
    key: 'assessment' as const,
    letter: 'A',
    label: 'Assessment',
    placeholder: 'Clinical diagnosis, differential diagnoses, severity...',
    color: '#FAEEDA', textColor: '#633806', borderColor: '#EF9F27',
  },
  {
    key: 'plan' as const,
    letter: 'P',
    label: 'Plan',
    placeholder: 'Prescriptions, lab orders, referrals, follow-up instructions...',
    color: '#EEEDFE', textColor: '#3C3489', borderColor: '#AFA9EC',
  },
] as const;

export function SoapEditor({ isLocked, initial, onSave }: SoapEditorProps) {
  const params = useParams<{ locale?: string }>();
  const locale = typeof params?.locale === 'string' ? params.locale : 'en';
  const t = useT(locale);
  const [data, setData] = useState<SoapData>({
    subjective: initial?.subjective ?? '',
    objective:  initial?.objective  ?? '',
    assessment: initial?.assessment ?? '',
    plan:       initial?.plan       ?? '',
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  const set = (key: keyof SoapData, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  async function handleSave() {
    if (!onSave) return;
    setSaving(true); setError('');
    try {
      await onSave(data);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Save failed'));
    } finally { setSaving(false); }
  }

  return (
    <div>
      {isLocked && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 12,
          background: '#FCEBEB', border: '.5px solid #F09595',
          fontSize: 12, color: '#791F1F',
        }}>
          {t('This record is locked. Only addendums can be added.')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {SECTIONS.map(s => (
          <div key={s.key} style={{
            border: `.5px solid ${s.borderColor}`,
            borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 12px',
              background: s.color,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: s.textColor }}>
                {s.letter}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: s.textColor }}>
                {t(`emr.${s.key}`)}
              </span>
            </div>
            <textarea
              value={data[s.key]}
              onChange={e => set(s.key, e.target.value)}
              disabled={isLocked}
              placeholder={t(s.placeholder)}
              rows={6}
              style={{
                width: '100%', border: 'none', padding: '10px 12px',
                fontSize: 12, lineHeight: 1.6, resize: 'vertical',
                background: isLocked ? 'var(--color-background-secondary)' : 'transparent',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
        ))}
      </div>

      {!isLocked && onSave && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding: '6px 18px' }}>
            {saving ? t('Saving...') : t('Save note')}
          </button>
          {saved && (
            <span style={{ fontSize: 12, color: '#1D9E75' }}>{t('Saved')}</span>
          )}
          {error && (
            <span style={{ fontSize: 12, color: '#E24B4A' }}>{error}</span>
          )}
        </div>
      )}
    </div>
  );
}
