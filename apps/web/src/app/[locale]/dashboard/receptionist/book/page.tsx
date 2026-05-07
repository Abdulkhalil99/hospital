'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { api }                 from '@/lib/api';

const NAV = [
  { label: 'Check-in',      icon: '✅', path: '/dashboard/receptionist' },
  { label: 'Book appt',     icon: '📅', path: '/dashboard/receptionist/book' },
  { label: 'Patients',      icon: '👥', path: '/dashboard/receptionist/patients' },
  { label: 'Today\'s list', icon: '📋', path: '/dashboard/receptionist/today' },
];

export default function BookAppointment({ params: { locale } }: { params: { locale: string } }) {
  const nav = NAV.map(n => ({ ...n, path: `/${locale}${n.path}` }));

  const [doctors,   setDoctors]   = useState<any[]>([]);
  const [types,     setTypes]     = useState<any[]>([]);
  const [patients,  setPatients]  = useState<any[]>([]);
  const [slots,     setSlots]     = useState<any[]>([]);
  const [patSearch, setPatSearch] = useState('');
  const [msg,       setMsg]       = useState('');
  const [loading,   setLoading]   = useState(false);

  const [form, setForm] = useState({
    patientId: '', doctorId: '', appointmentTypeId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledStart: '', notes: '',
  });

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/doctors'),
      api.get<any[]>('/appointments/types'),
    ]).then(([d, t]) => { setDoctors(d ?? []); setTypes(t ?? []); });
  }, []);

  useEffect(() => {
    if (!patSearch.trim()) { setPatients([]); return; }
    const t = setTimeout(() =>
      api.get<any>(`/patients?q=${patSearch}&limit=5`).then(r => setPatients(r.data ?? [])), 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  useEffect(() => {
    if (!form.doctorId || !form.scheduledDate) { setSlots([]); return; }
    api.get<any>(`/doctors/${form.doctorId}/availability?date=${form.scheduledDate}`)
      .then(r => setSlots(r.slots?.filter((s: any) => s.available) ?? []));
  }, [form.doctorId, form.scheduledDate]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault(); setMsg(''); setLoading(true);
    try {
      await api.post('/appointments', form);
      setMsg('✅ Appointment booked successfully');
      setForm(p => ({ ...p, scheduledStart: '', notes: '' }));
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    }
    setLoading(false);
  }

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <DashboardShell navItems={nav} title="Book Appointment" locale={locale}>
      <div style={{ maxWidth: 700 }}>
        <form onSubmit={handleBook}>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px', marginBottom: 16 }}>

            {/* Patient search */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Patient *</label>
              <input value={patSearch} onChange={e => setPatSearch(e.target.value)} placeholder="Search patient by name, MRN, or phone…" />
              {patients.length > 0 && (
                <div style={{ border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#fff' }}>
                  {patients.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => { set('patientId', p.id); setPatSearch(`${p.first_name} ${p.last_name} (${p.mrn})`); setPatients([]); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f5f5f5', display: 'flex', gap: 10 }}
                    >
                      <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{p.mrn}</span>
                      <span>{p.first_name} {p.last_name}</span>
                      <span style={{ color: '#888', marginLeft: 'auto' }}>{p.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Doctor */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Doctor *</label>
              <select value={form.doctorId} onChange={e => set('doctorId', e.target.value)} required>
                <option value="">Select doctor…</option>
                {doctors.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.title} {d.full_name} — {d.specialty_name}</option>
                ))}
              </select>
            </div>

            {/* Appointment type */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Appointment type *</label>
              <select value={form.appointmentTypeId} onChange={e => set('appointmentTypeId', e.target.value)} required>
                <option value="">Select type…</option>
                {types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Date */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Date *</label>
              <input type="date" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} required style={{ width: 'auto' }} />
            </div>

            {/* Time slots */}
            {slots.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Available slots</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
                  {slots.map((s: any) => (
                    <button
                      key={s.startTime} type="button"
                      onClick={() => set('scheduledStart', s.startTime)}
                      style={{
                        padding: '7px 4px', fontSize: 12, borderRadius: 6,
                        background: form.scheduledStart === s.startTime ? '#185FA5' : '#f0f7ff',
                        color:      form.scheduledStart === s.startTime ? '#fff'    : '#185FA5',
                        border: `1px solid ${form.scheduledStart === s.startTime ? '#185FA5' : '#cce3f9'}`,
                      }}
                    >
                      {s.startTime}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {form.doctorId && form.scheduledDate && slots.length === 0 && (
              <div style={{ fontSize: 13, color: '#888', padding: '10px 14px', background: '#f5f5f5', borderRadius: 6, marginBottom: 16 }}>
                No available slots for this date
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Optional notes…" />
            </div>

            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}

            <button type="submit" disabled={loading || !form.patientId || !form.scheduledStart} style={{ padding: '10px 28px' }}>
              {loading ? 'Booking…' : 'Book appointment'}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
