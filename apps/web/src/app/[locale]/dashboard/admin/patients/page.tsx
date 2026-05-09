'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function AdminPatients({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [patients, setPatients] = useState<any[]>([]);
  const [q,        setQ]        = useState('');
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [msg,      setMsg]      = useState('');
  const [form,     setForm]     = useState({
    firstName: '', lastName: '', dateOfBirth: '',
    gender: 'male', phone: '', bloodType: 'unknown',
    preferredLanguage: 'fa', skipOtp: true,
  });

  useEffect(() => { load(); }, [q]);

  async function load() {
    setLoading(true);
    const res = await api.get<any>(`/patients?q=${q}&limit=30`);
    setPatients(res.data ?? []);
    setTotal(res.pagination?.total ?? 0);
    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      const res = await api.post<any>('/patients', form);
      setMsg(`✅ Patient registered — MRN: ${res.patient?.mrn}`);
      setShowForm(false); load();
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
  }

  return (
    <DashboardShell navItems={nav} title="Patients" locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ flex: 1, maxWidth: 400 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, MRN, phone…" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginLeft: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#888' }}>Total: {total}</span>
          <button onClick={() => setShowForm(p => !p)}>
            {showForm ? '✕ Cancel' : '+ Register patient'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>
          {msg}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Register new patient</div>
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[['firstName','First name *'],['lastName','Last name *']].map(([k,l]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{l}</label>
                  <input value={(form as any)[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} required />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Date of birth *</label>
                <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({...p,dateOfBirth:e.target.value}))} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Gender *</label>
                <select value={form.gender} onChange={e => setForm(p => ({...p,gender:e.target.value}))}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Phone *</label>
                <input value={form.phone} onChange={e => setForm(p => ({...p,phone:e.target.value}))} required placeholder="07XXXXXXXX" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Blood type</label>
                <select value={form.bloodType} onChange={e => setForm(p => ({...p,bloodType:e.target.value}))}>
                  {['unknown','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <button type="submit">Register</button>
          </form>
        </div>
      )}

      <DataTable
        keyField="id" loading={loading} rows={patients} empty="No patients found"
        columns={[
          { key: 'mrn', label: 'MRN', width: '150px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(r.mrn)}</span> },
          { key: 'first_name', label: 'Name',
            render: r => `${r.first_name} ${r.last_name}` },
          { key: 'date_of_birth', label: 'DOB', width: '120px',
            render: r => formatDate(String(r.date_of_birth ?? ''), locale) },
          { key: 'gender', label: 'Gender', width: '90px',
            render: r => <Badge label={String(r.gender)} preset="info" /> },
          { key: 'phone', label: 'Phone' },
          { key: 'blood_type', label: 'Blood', width: '80px' },
          { key: 'has_allergies', label: 'Allergy', width: '90px',
            render: r => r.has_allergies ? <Badge label="⚠ Yes" preset="danger" /> : <Badge label="—" preset="gray" /> },
        ]}
      />
    </DashboardShell>
  );
}
