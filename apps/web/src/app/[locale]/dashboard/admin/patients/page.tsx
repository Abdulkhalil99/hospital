'use client';
import { useEffect, useState, useCallback } from 'react';
import { DashboardShell }   from '@/components/layout/DashboardShell';
import { DataTable }        from '@/components/layout/DataTable';
import { Badge }            from '@/components/layout/Badge';
import { StatCard }         from '@/components/layout/StatCard';
import { api }              from '@/lib/api';
import { useT, formatDate } from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function AdminPatients({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [patients, setPatients] = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [q,        setQ]        = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '',
    gender: 'male', phone: '', bloodType: 'unknown',
    preferredLanguage: 'fa', skipOtp: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/patients?q=${encodeURIComponent(q)}&limit=30&page=1`);
      // Handle both {data: [...]} and [...] response shapes
      if (Array.isArray(res)) {
        setPatients(res);
        setTotal(res.length);
      } else if (res && Array.isArray(res.data)) {
        setPatients(res.data);
        setTotal(res.pagination?.total ?? res.data.length);
      } else {
        setPatients([]);
        setTotal(0);
      }
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const res = await api.post<any>('/patients', form);
      // Response can be {patient: {...}} or the patient directly
      const patient = res?.patient ?? res;
      setMsg(`✅ Patient registered — MRN: ${patient?.mrn ?? 'created'}`);
      setShowForm(false);
      setForm({ firstName: '', lastName: '', dateOfBirth: '', gender: 'male', phone: '', bloodType: 'unknown', preferredLanguage: 'fa', skipOtp: true });
      // Reload list after short delay
      setTimeout(load, 500);
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 } as const;

  return (
    <DashboardShell navItems={nav} title="Patients" locale={locale}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total patients" value={total} icon="👥" color="#185FA5" />
        <StatCard label="Loaded"         value={patients.length} icon="📋" color="#0F6E56" />
        <StatCard label="Search results" value={q ? patients.length : total} icon="🔍" color="#854F0B" />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, MRN, or phone…"
          />
        </div>
        <button onClick={load} style={{ background: '#f0f0f0', color: '#333', padding: '9px 16px', fontSize: 13 }}>
          🔄 Refresh
        </button>
        <button onClick={() => setShowForm(p => !p)}>
          {showForm ? '✕ Cancel' : '+ Register patient'}
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13,
          background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          color:      msg.startsWith('✅') ? '#166534' : '#991b1b',
        }}>
          {msg}
        </div>
      )}

      {/* Register form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Register new patient</div>
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>First name *</label>
                <input value={form.firstName} onChange={e => setForm(p => ({...p, firstName: e.target.value}))} required placeholder="Ahmad" />
              </div>
              <div>
                <label style={labelStyle}>Last name *</label>
                <input value={form.lastName} onChange={e => setForm(p => ({...p, lastName: e.target.value}))} required placeholder="Karimi" />
              </div>
              <div>
                <label style={labelStyle}>Date of birth *</label>
                <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({...p, dateOfBirth: e.target.value}))} required />
              </div>
              <div>
                <label style={labelStyle}>Gender *</label>
                <select value={form.gender} onChange={e => setForm(p => ({...p, gender: e.target.value}))}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Phone *</label>
                <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} required placeholder="0700000000" />
              </div>
              <div>
                <label style={labelStyle}>Blood type</label>
                <select value={form.bloodType} onChange={e => setForm(p => ({...p, bloodType: e.target.value}))}>
                  {['unknown','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Preferred language</label>
                <select value={form.preferredLanguage} onChange={e => setForm(p => ({...p, preferredLanguage: e.target.value}))}>
                  <option value="fa">فارسی</option>
                  <option value="ps">پښتو</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving}>
                {saving ? 'Registering…' : 'Register patient'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: '#f0f0f0', color: '#555' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Patients table */}
      <DataTable
        keyField="id"
        loading={loading}
        rows={patients}
        empty={q ? `No patients found matching "${q}"` : 'No patients registered yet. Click "+ Register patient" to add one.'}
        columns={[
          { key: 'mrn', label: 'MRN', width: '150px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(r.mrn ?? '—')}</span> },
          { key: 'name', label: 'Full name',
            render: r => <strong>{`${r.first_name ?? ''} ${r.last_name ?? ''}`}</strong> },
          { key: 'date_of_birth', label: 'Date of birth', width: '130px',
            render: r => r.date_of_birth ? formatDate(String(r.date_of_birth), locale) : '—' },
          { key: 'gender', label: 'Gender', width: '90px',
            render: r => <Badge label={String(r.gender ?? '—')} preset="info" /> },
          { key: 'phone', label: 'Phone', width: '130px' },
          { key: 'blood_type', label: 'Blood', width: '80px',
            render: r => String(r.blood_type ?? '—') },
          { key: 'has_allergies', label: 'Allergy', width: '90px',
            render: r => r.has_allergies
              ? <Badge label="⚠ Yes" preset="danger" />
              : <Badge label="None" preset="gray" /> },
        ]}
      />
    </DashboardShell>
  );
}
