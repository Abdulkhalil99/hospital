'use client';
import { useState, useEffect } from 'react';

const API = 'http://localhost:3000/api/v1';

// ── helpers ──────────────────────────────────────────────────
async function apiFetch(path: string, token?: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return res.json();
}

async function apiPost(path: string, body: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── colour helpers ────────────────────────────────────────────
const COLORS = {
  blue:   '#185FA5',
  teal:   '#0F6E56',
  amber:  '#854F0B',
  red:    '#A32D2D',
  purple: '#3C3489',
  gray:   '#5F5E5A',
};

const card = {
  background: '#fff',
  borderRadius: 10,
  border: '1px solid #e8e8e8',
  padding: '20px 24px',
  boxShadow: '0 1px 4px rgba(0,0,0,.06)',
} as const;

const badge = (bg: string, color: string) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  background: bg,
  color,
}) as const;

// ════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }: { onLogin: (token: string, user: unknown) => void }) {
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('Admin@123456');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await apiPost('/auth/login', { username, password });
      if (res.success) {
        localStorage.setItem('medicore_token', res.data.accessToken);
        onLogin(res.data.accessToken, res.data.user);
      } else {
        setError(res.error?.message ?? 'Login failed');
      }
    } catch {
      setError('Cannot connect to server. Is the API running?');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #185FA5 0%, #0F6E56 100%)' }}>
      <div style={{ ...card, width: 380, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏥</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#185FA5' }}>MediCore HMS</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Hospital Management System</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#444' }}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required placeholder="superadmin" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#444' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '11px 0', fontSize: 15 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div style={{ marginTop: 20, padding: '10px 14px', background: '#f0f7ff', borderRadius: 6, fontSize: 12, color: '#555' }}>
          <strong>Default credentials:</strong><br />
          Username: superadmin<br />
          Password: Admin@123456
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// STAT CARD
// ════════════════════════════════════════════════════════════
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PATIENTS TAB
// ════════════════════════════════════════════════════════════
function PatientsTab({ token }: { token: string }) {
  const [patients, setPatients] = useState<any[]>([]);
  const [q,        setQ]        = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ firstName: '', lastName: '', dateOfBirth: '', gender: 'male', phone: '', bloodType: 'unknown', preferredLanguage: 'fa', skipOtp: true });
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');

  useEffect(() => { loadPatients(); }, [q]);

  async function loadPatients() {
    setLoading(true);
    const res = await apiFetch(`/patients?q=${q}&limit=20`, token);
    if (res.success) setPatients(res.data ?? []);
    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('');
    const res = await apiPost('/patients', form, token);
    if (res.success) {
      setMsg(`✅ Patient registered. MRN: ${res.data.patient?.mrn}`);
      setShowForm(false); loadPatients();
    } else {
      setMsg(`❌ ${res.error?.message}`);
    }
    setSaving(false);
  }

  const ESI_COLORS: Record<string, string> = { 'A+': '#e8f5e9', 'O+': '#e3f2fd', 'B+': '#fff3e0', 'AB+': '#f3e5f5' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Patients</h2>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? '✕ Cancel' : '+ Register patient'}</button>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Register New Patient</h3>
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['firstName','First name'],['lastName','Last name']].map(([k, l]) => (
                <div key={k}><label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>{l} *</label>
                <input value={(form as any)[k]} onChange={e => setForm(p => ({...p, [k]: e.target.value}))} required /></div>
              ))}
              <div><label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Date of birth *</label>
              <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({...p, dateOfBirth: e.target.value}))} required /></div>
              <div><label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Gender *</label>
              <select value={form.gender} onChange={e => setForm(p => ({...p, gender: e.target.value}))}>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select></div>
              <div><label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Phone *</label>
              <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} required placeholder="07XXXXXXXX" /></div>
              <div><label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Blood type</label>
              <select value={form.bloodType} onChange={e => setForm(p => ({...p, bloodType: e.target.value}))}>
                {['unknown','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}
              </select></div>
            </div>
            {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Register'}</button>
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ ...card, marginBottom: 16 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, MRN, or phone…" />
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div> : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                {['MRN','Name','DOB','Gender','Phone','Blood','Allergies'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No patients found</td></tr>
              )}
              {patients.map((p: any, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: COLORS.blue, fontWeight: 600 }}>{p.mrn}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{p.first_name} {p.last_name}</td>
                  <td style={{ padding: '10px 16px', color: '#666' }}>{p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#666', textTransform: 'capitalize' }}>{p.gender}</td>
                  <td style={{ padding: '10px 16px', color: '#666' }}>{p.phone}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={badge(ESI_COLORS[p.blood_type] ?? '#f5f5f5', '#333')}>{p.blood_type}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {p.has_allergies && <span style={badge('#fef2f2', '#991b1b')}>⚠ Allergy</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DOCTORS TAB
// ════════════════════════════════════════════════════════════
function DoctorsTab({ token }: { token: string }) {
  const [doctors,  setDoctors]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    apiFetch('/doctors', token).then(r => { if (r.success) setDoctors(r.data ?? []); setLoading(false); });
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Doctors</h2>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {doctors.map((d: any) => (
            <div key={d.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: COLORS.purple }}>
                  {(d.full_name ?? 'D').split(' ').map((w: string) => w[0]).join('').slice(0,2)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title} {d.full_name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{d.specialty_name ?? 'General'}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span style={badge(d.is_available ? '#f0fdf4' : '#fef2f2', d.is_available ? '#166534' : '#991b1b')}>
                    {d.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                <span>{d.department_name ?? 'General Medicine'}</span>
                <span style={{ fontWeight: 600, color: COLORS.teal }}>AFN {d.consultation_fee}</span>
              </div>
            </div>
          ))}
          {doctors.length === 0 && <div style={{ color: '#aaa', padding: 40 }}>No doctors found</div>}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// APPOINTMENTS TAB
// ════════════════════════════════════════════════════════════
function AppointmentsTab({ token }: { token: string }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [date,         setDate]         = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    const res = await apiFetch(`/appointments?date=${date}&limit=50`, token);
    if (res.success) setAppointments(res.data ?? []);
    setLoading(false);
  }

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    scheduled:  { bg: '#eff6ff', color: '#1d4ed8' },
    confirmed:  { bg: '#f0fdf4', color: '#166534' },
    checked_in: { bg: '#fefce8', color: '#854d0e' },
    in_progress:{ bg: '#fff7ed', color: '#9a3412' },
    completed:  { bg: '#f0fdf4', color: '#166534' },
    cancelled:  { bg: '#fef2f2', color: '#991b1b' },
    no_show:    { bg: '#f9fafb', color: '#6b7280' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Appointments</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div> : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                {['Time','Patient','Doctor','Type','Status'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No appointments for this date</td></tr>
              )}
              {appointments.map((a: any, i) => {
                const sc = STATUS_COLORS[a.status] ?? STATUS_COLORS.scheduled;
                return (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {a.scheduled_start ? String(a.scheduled_start).slice(0,5) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{a.patient_name}</td>
                    <td style={{ padding: '10px 16px', color: '#666' }}>{a.doctor_name}</td>
                    <td style={{ padding: '10px 16px', color: '#666' }}>{a.type_name ?? '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={badge(sc.bg, sc.color)}>{a.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PHARMACY TAB
// ════════════════════════════════════════════════════════════
function PharmacyTab({ token }: { token: string }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [alerts,    setAlerts]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/pharmacy/inventory', token),
      apiFetch('/pharmacy/alerts/low-stock', token),
    ]).then(([inv, al]) => {
      if (inv.success) setInventory(inv.data ?? []);
      if (al.success)  setAlerts(al.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Pharmacy</h2>

      {alerts.length > 0 && (
        <div style={{ ...card, background: '#fffbeb', border: '1px solid #fbbf24', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 8 }}>⚠ Stock Alerts ({alerts.length})</div>
          {alerts.slice(0,5).map((a: any, i) => (
            <div key={i} style={{ fontSize: 13, color: '#78350f', padding: '4px 0', borderTop: i > 0 ? '1px solid #fde68a' : 'none' }}>
              <strong>{a.generic_name}</strong> — {a.alert_type.replace('_',' ')} ({a.quantity_on_hand} remaining)
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div> : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                {['Drug','Form','Strength','Location','On hand','Reorder at','Status'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.slice(0, 30).map((inv: any, i) => {
                const isLow = inv.quantity_on_hand <= inv.reorder_level;
                const isOut = inv.quantity_on_hand === 0;
                return (
                  <tr key={inv.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{inv.generic_name}</td>
                    <td style={{ padding: '10px 16px', color: '#666' }}>{inv.dosage_form}</td>
                    <td style={{ padding: '10px 16px', color: '#666' }}>{inv.strength}</td>
                    <td style={{ padding: '10px 16px', color: '#666' }}>{inv.location}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: isOut ? '#991b1b' : isLow ? '#92400e' : '#166534' }}>
                      {inv.quantity_on_hand}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#666' }}>{inv.reorder_level}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={badge(
                        isOut ? '#fef2f2' : isLow ? '#fffbeb' : '#f0fdf4',
                        isOut ? '#991b1b' : isLow ? '#92400e' : '#166534',
                      )}>
                        {isOut ? 'Out of stock' : isLow ? 'Low stock' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// LABORATORY TAB
// ════════════════════════════════════════════════════════════
function LaboratoryTab({ token }: { token: string }) {
  const [tests,   setTests]   = useState<any[]>([]);
  const [alerts,  setAlerts]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/laboratory/tests', token),
      apiFetch('/laboratory/critical-alerts', token),
    ]).then(([t, a]) => {
      if (t.success) setTests(t.data ?? []);
      if (a.success) setAlerts(a.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Laboratory</h2>

      {alerts.length > 0 && (
        <div style={{ ...card, background: '#fef2f2', border: '1px solid #fca5a5', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>🚨 Critical Value Alerts ({alerts.length})</div>
          {alerts.map((a: any, i) => (
            <div key={i} style={{ fontSize: 13, color: '#7f1d1d', padding: '6px 0', borderTop: i > 0 ? '1px solid #fca5a5' : 'none' }}>
              <strong>{a.patient_name}</strong> ({a.patient_mrn}) — {a.component_name}: <strong>{a.result_value}</strong> [{a.flag}] — Dr. {a.doctor_name}
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
          {tests.map((t: any) => (
            <div key={t.id} style={{ ...card, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{t.category}</div>
                </div>
                <span style={badge('#eff6ff', '#1d4ed8')}>{t.code}</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 10, fontSize: 12, color: '#666' }}>
                <span>🧪 {t.sample_type}</span>
                <span>⏱ {t.turnaround_hours}h</span>
                <span>💰 AFN {t.price}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// BILLING TAB
// ════════════════════════════════════════════════════════════
function BillingTab({ token }: { token: string }) {
  const [invoices,  setInvoices]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { load(); }, [statusFilter]);

  async function load() {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}&limit=30` : '?limit=30';
    const res = await apiFetch(`/billing${qs}`, token);
    if (res.success) setInvoices(res.data ?? []);
    setLoading(false);
  }

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    draft:     { bg: '#f9fafb', color: '#6b7280' },
    issued:    { bg: '#eff6ff', color: '#1d4ed8' },
    partial:   { bg: '#fffbeb', color: '#92400e' },
    paid:      { bg: '#f0fdf4', color: '#166534' },
    cancelled: { bg: '#fef2f2', color: '#991b1b' },
    void:      { bg: '#f9fafb', color: '#9ca3af' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Billing</h2>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All statuses</option>
          {['draft','issued','partial','paid','cancelled','void'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div> : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                {['Invoice #','Patient','Total','Paid','Balance','Status'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No invoices found</td></tr>
              )}
              {invoices.map((inv: any, i) => {
                const sc = STATUS_COLORS[inv.status] ?? STATUS_COLORS.draft;
                return (
                  <tr key={inv.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: COLORS.blue, fontWeight: 600 }}>{inv.invoice_number}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{inv.patient_name}</td>
                    <td style={{ padding: '10px 16px' }}>AFN {Number(inv.total_amount).toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: '#166534' }}>AFN {Number(inv.paid_amount).toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: Number(inv.balance_due) > 0 ? '#991b1b' : '#166534', fontWeight: 600 }}>
                      AFN {Number(inv.balance_due).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={badge(sc.bg, sc.color)}>{inv.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// EMERGENCY TAB
// ════════════════════════════════════════════════════════════
function EmergencyTab({ token }: { token: string }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    apiFetch('/emergency/dashboard', token).then(r => {
      if (r.success) setDashboard(r.data);
      setLoading(false);
    });
  }, []);

  const ESI_STYLE: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: '#991b1b', color: '#fff',    label: 'Immediate' },
    2: { bg: '#ea580c', color: '#fff',    label: 'Emergent' },
    3: { bg: '#ca8a04', color: '#fff',    label: 'Urgent' },
    4: { bg: '#16a34a', color: '#fff',    label: 'Less urgent' },
    5: { bg: '#2563eb', color: '#fff',    label: 'Non-urgent' },
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div>;
  if (!dashboard) return <div style={{ color: '#aaa' }}>Could not load dashboard</div>;

  const { stats, visits } = dashboard;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Emergency Department</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Active now"  value={stats?.active_count    ?? 0} icon="🚨" color={COLORS.red} />
        <StatCard label="Today total" value={stats?.total_visits    ?? 0} icon="📋" color={COLORS.blue} />
        <StatCard label="Level 1"     value={stats?.level_1_count  ?? 0} icon="❗" color="#991b1b" />
        <StatCard label="Discharged"  value={stats?.discharged_count ?? 0} icon="✅" color={COLORS.teal} />
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {['Patient','Complaint','ESI','Bed','Status','Time in ED'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(visits ?? []).length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No active visits</td></tr>
            )}
            {(visits ?? []).map((v: any, i: number) => {
              const esi = ESI_STYLE[v.triage_level] ?? { bg: '#f5f5f5', color: '#333', label: 'Untriaged' };
              const mins = Math.floor(v.minutes_in_ed ?? 0);
              return (
                <tr key={v.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{v.patient_name}</td>
                  <td style={{ padding: '10px 16px', color: '#555', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.chief_complaint}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {v.triage_level
                      ? <span style={badge(esi.bg, esi.color)}>ESI {v.triage_level} — {esi.label}</span>
                      : <span style={badge('#f5f5f5', '#999')}>Untriaged</span>}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: COLORS.blue }}>{v.bed_code ?? '—'}</td>
                  <td style={{ padding: '10px 16px', textTransform: 'capitalize', color: '#555' }}>{v.status}</td>
                  <td style={{ padding: '10px 16px', color: mins > 120 ? '#991b1b' : '#555', fontWeight: mins > 120 ? 600 : 400 }}>
                    {mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// OVERVIEW TAB (home dashboard)
// ════════════════════════════════════════════════════════════
function OverviewTab({ token }: { token: string }) {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/patients?limit=1',     token),
      apiFetch('/doctors',              token),
      apiFetch('/appointments?limit=1', token),
      apiFetch('/pharmacy/alerts/low-stock', token),
      apiFetch('/laboratory/critical-alerts', token),
    ]).then(([pt, dr, ap, ph, lb]) => {
      setData({
        patientTotal: pt.pagination?.total ?? 0,
        doctorTotal:  (dr.data ?? []).length,
        apptTotal:    ap.pagination?.total ?? 0,
        lowStock:     (ph.data ?? []).length,
        critAlerts:   (lb.data ?? []).length,
      });
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading dashboard…</div>;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>System Overview</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total patients"       value={data.patientTotal} icon="👥" color={COLORS.blue} />
        <StatCard label="Active doctors"       value={data.doctorTotal}  icon="👨‍⚕️" color={COLORS.teal} />
        <StatCard label="All appointments"     value={data.apptTotal}    icon="📅" color={COLORS.purple} />
        <StatCard label="Low stock drugs"      value={data.lowStock}     icon="💊" color={COLORS.amber} />
        <StatCard label="Critical lab alerts"  value={data.critAlerts}   icon="🚨" color={COLORS.red} />
      </div>

      <div style={{ ...card }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>System modules</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { name: 'Patients',      icon: '👥', color: COLORS.blue },
            { name: 'Doctors',       icon: '��‍⚕️', color: COLORS.teal },
            { name: 'Appointments',  icon: '📅', color: COLORS.purple },
            { name: 'EMR',           icon: '📋', color: COLORS.amber },
            { name: 'Pharmacy',      icon: '💊', color: COLORS.teal },
            { name: 'Laboratory',    icon: '🧪', color: COLORS.blue },
            { name: 'Emergency',     icon: '🚨', color: COLORS.red },
            { name: 'Billing',       icon: '💰', color: COLORS.gray },
            { name: 'Notifications', icon: '🔔', color: COLORS.purple },
            { name: 'Telemedicine',  icon: '📹', color: COLORS.teal },
          ].map(m => (
            <div key={m.name} style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${m.color}22`, background: m.color + '0d', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: m.color }}>{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════
const TABS = [
  { id: 'overview',      label: 'Overview',      icon: '🏠' },
  { id: 'patients',      label: 'Patients',      icon: '👥' },
  { id: 'doctors',       label: 'Doctors',       icon: '👨‍⚕️' },
  { id: 'appointments',  label: 'Appointments',  icon: '📅' },
  { id: 'pharmacy',      label: 'Pharmacy',      icon: '💊' },
  { id: 'laboratory',    label: 'Laboratory',    icon: '🧪' },
  { id: 'emergency',     label: 'Emergency',     icon: '🚨' },
  { id: 'billing',       label: 'Billing',       icon: '💰' },
];

export default function Dashboard({ params }: { params: { locale: string } }) {
  const [token, setToken] = useState<string | null>(null);
  const [user,  setUser]  = useState<any>(null);
  const [tab,   setTab]   = useState('overview');

  useEffect(() => {
    const t = localStorage.getItem('medicore_token');
    if (t) setToken(t);
  }, []);

  function handleLogin(t: string, u: unknown) {
    setToken(t); setUser(u);
  }

  function handleLogout() {
    localStorage.removeItem('medicore_token');
    setToken(null); setUser(null);
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, bottom: 0, left: 0 }}>
        <div style={{ padding: '20px 18px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 20, marginBottom: 2 }}>🏥</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.blue }}>MediCore</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>Hospital Management</div>
        </div>

        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left',
                padding: '9px 12px', borderRadius: 7, marginBottom: 2,
                background: tab === t.id ? COLORS.blue + '12' : 'transparent',
                color:      tab === t.id ? COLORS.blue : '#555',
                fontWeight: tab === t.id ? 600 : 400,
                fontSize: 13, border: 'none',
                transition: 'all .12s',
              }}
            >
              <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '14px 18px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 2 }}>{user?.username ?? 'superadmin'}</div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>Administrator</div>
          <button onClick={handleLogout} style={{ width: '100%', background: '#f5f5f5', color: '#666', fontSize: 12, padding: '6px 0' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 220, padding: '28px 32px', minWidth: 0 }}>
        {tab === 'overview'     && <OverviewTab     token={token} />}
        {tab === 'patients'     && <PatientsTab     token={token} />}
        {tab === 'doctors'      && <DoctorsTab      token={token} />}
        {tab === 'appointments' && <AppointmentsTab token={token} />}
        {tab === 'pharmacy'     && <PharmacyTab     token={token} />}
        {tab === 'laboratory'   && <LaboratoryTab   token={token} />}
        {tab === 'emergency'    && <EmergencyTab    token={token} />}
        {tab === 'billing'      && <BillingTab      token={token} />}
      </main>
    </div>
  );
}
