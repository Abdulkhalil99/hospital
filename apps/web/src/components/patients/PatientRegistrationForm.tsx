'use client';
import { useState }          from 'react';
import { patientsService }   from '@/services/patients.service';

type Step = 'form' | 'otp' | 'done';

export function PatientRegistrationForm({ onSuccess }: { onSuccess?: (mrn: string) => void }) {
  const [step,     setStep]     = useState<Step>('form');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [patientId, setPatientId] = useState('');
  const [otpTarget, setOtpTarget] = useState('');
  const [mrn,      setMrn]      = useState('');
  const [otpCode,  setOtpCode]  = useState('');

  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '',
    gender: 'male', bloodType: 'unknown', phone: '',
    email: '', nationalId: '', address: '',
    preferredLanguage: 'fa', skipOtp: false,
  });

  const set = (k: string, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await patientsService.register(form) as {
        patient: { id: string; mrn: string };
        otpRequired: boolean;
        otpId?: string;
      };
      setPatientId(result.patient.id);
      setMrn(result.patient.mrn);
      if (result.otpRequired) {
        setOtpTarget(form.email || form.phone);
        setStep('otp');
      } else {
        setStep('done');
        onSuccess?.(result.patient.mrn);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await patientsService.verifyOtp(patientId, otpTarget, otpCode);
      setStep('done');
      onSuccess?.(mrn);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally { setLoading(false); }
  }

  async function handleResend() {
    setError(''); setLoading(true);
    try {
      const type = form.email ? 'email' : 'phone';
      await patientsService.resendOtp(patientId, otpTarget, type);
      setError('New code sent.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend');
    } finally { setLoading(false); }
  }

  const field = <K extends keyof typeof form>(
  label: string,
  key: K,
  type = 'text',
  required = false
) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
        {label}{required && <span style={{ color: 'var(--color-text-danger)', marginLeft: 2 }}>*</span>}
      </label>
      <input
        type={type}
        value={String(form[key] ?? '')}
        onChange={e => set(key, e.target.value)}
        required={required}
        style={{ width: '100%' }}
      />
    </div>
  );

  if (step === 'done') return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
        Patient registered
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
        MRN: <strong>{mrn}</strong>
      </div>
    </div>
  );

  if (step === 'otp') return (
    <form onSubmit={handleVerifyOtp}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Verify contact</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          A 6-digit code was sent to <strong>{otpTarget}</strong>.
          It expires in 10 minutes.
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          Verification code *
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otpCode}
          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
          style={{ width: '100%', letterSpacing: '0.3em', fontSize: 18 }}
          required
        />
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--color-text-danger)', marginBottom: 8 }}>{error}</div>}
      <button type="submit" disabled={loading || otpCode.length < 6} style={{ width: '100%', marginBottom: 8 }}>
        {loading ? 'Verifying...' : 'Verify'}
      </button>
      <button type="button" onClick={handleResend} disabled={loading}
        style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 12,
                 color: 'var(--color-text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
        Resend code
      </button>
    </form>
  );

  return (
    <form onSubmit={handleRegister}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <div>{field('First name', 'firstName', 'text', true)}</div>
        <div>{field('Last name',  'lastName',  'text', true)}</div>
      </div>
      {field('Date of birth', 'dateOfBirth', 'date', true)}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          Gender *
        </label>
        <select value={form.gender} onChange={e => set('gender', e.target.value)} style={{ width: '100%' }}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          Blood type
        </label>
        <select value={form.bloodType} onChange={e => set('bloodType', e.target.value)} style={{ width: '100%' }}>
          {['unknown','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
      </div>
      {field('Phone *', 'phone', 'tel', true)}
      {field('Email',   'email', 'email')}
      {field('National ID', 'nationalId')}
      {field('Address', 'address')}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          Preferred language
        </label>
        <select value={form.preferredLanguage} onChange={e => set('preferredLanguage', e.target.value)} style={{ width: '100%' }}>
          <option value="fa">Persian — فارسی</option>
          <option value="ps">Pashto — پښتو</option>
          <option value="en">English</option>
        </select>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                      color: 'var(--color-text-secondary)', marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.skipOtp}
               onChange={e => set('skipOtp', e.target.checked)} />
        Emergency walk-in — skip OTP verification
      </label>
      {error && <div style={{ fontSize: 12, color: 'var(--color-text-danger)', marginBottom: 8 }}>{error}</div>}
      <button type="submit" disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Registering...' : 'Register patient'}
      </button>
    </form>
  );
}


// this file has error to solve later 