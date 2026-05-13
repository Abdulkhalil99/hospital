'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

const INITIAL_FORM = {
  username: '',
  fullName: '',
  email: '',
  password: '',
  preferredLanguage: 'fa',
  title: 'Dr.',
  licenseNumber: '',
  specialtyId: '',
  departmentId: '',
  consultationFee: '300',
  licenseExpiresAt: '',
  bio: '',
  createSchedule: true,
  scheduleDays: [0, 1, 2, 3, 4, 5],
  scheduleStartTime: '08:00',
  scheduleEndTime: '17:00',
  slotDuration: '15',
  maxPatients: '1',
  location: '',
  effectiveFrom: todayIso(),
};

export default function AdminDoctors({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [doctors,  setDoctors]  = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctorRoleId, setDoctorRoleId] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(INITIAL_FORM);

  async function loadDoctors() {
    const rows = await api.get<any[]>('/doctors');
    setDoctors(rows ?? []);
  }

  useEffect(() => {
    Promise.all([
      loadDoctors(),
      api.get<any[]>('/doctors/specialties'),
      api.get<any[]>('/doctors/departments'),
      api.get<any[]>('/admin/roles'),
    ]).then(([, specialtyRows, departmentRows, roleRows]) => {
      setSpecialties(specialtyRows ?? []);
      setDepartments(departmentRows ?? []);
      const doctorRole = (roleRows ?? []).find((role: any) => role.name === 'doctor');
      setDoctorRoleId(doctorRole?.id ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function setField<K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleScheduleDay(day: number) {
    setForm(prev => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter((value) => value !== day)
        : [...prev.scheduleDays, day].sort((a, b) => a - b),
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');

    if (!doctorRoleId) {
      setMsg('❌ Doctor role is not configured in the system yet.');
      return;
    }

    if (form.createSchedule && form.scheduleDays.length === 0) {
      setMsg('❌ Select at least one working day or turn off schedule creation.');
      return;
    }

    setSaving(true);
    let createdUserId = '';
    let doctorCreated = false;

    try {
      const user = await api.post<any>('/admin/users', {
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        preferredLanguage: form.preferredLanguage,
        roleIds: [doctorRoleId],
      });
      createdUserId = String(user.id);

      const doctor = await api.post<any>('/doctors', {
        userId: createdUserId,
        title: form.title.trim() || 'Dr.',
        licenseNumber: form.licenseNumber.trim(),
        specialtyId: form.specialtyId || undefined,
        departmentId: form.departmentId || undefined,
        consultationFee: Number(form.consultationFee || 0),
        licenseExpiresAt: form.licenseExpiresAt || undefined,
        bio: form.bio.trim() || undefined,
      });
      doctorCreated = true;

      if (form.createSchedule) {
        for (const day of form.scheduleDays) {
          await api.put(`/doctors/${doctor.id}/schedules`, {
            dayOfWeek: day,
            startTime: form.scheduleStartTime,
            endTime: form.scheduleEndTime,
            slotDuration: Number(form.slotDuration),
            maxPatients: Number(form.maxPatients),
            location: form.location.trim() || undefined,
            effectiveFrom: form.effectiveFrom,
          });
        }
      }

      await loadDoctors();
      setForm({ ...INITIAL_FORM, effectiveFrom: todayIso() });
      setShowCreate(false);
      setMsg('✅ Doctor account created successfully.');
    } catch (err: any) {
      if (createdUserId && !doctorCreated) {
        try { await api.delete(`/admin/users/${createdUserId}`); } catch {}
      }
      const prefix = doctorCreated
        ? '⚠ Doctor account was created, but the schedule setup did not finish.'
        : '❌';
      setMsg(`${prefix} ${err.message ?? 'Unable to create doctor.'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell navItems={nav} title="Doctors" locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1f2937' }}>{doctors.length} doctors registered</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Create both the login account and the medical profile from one place.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href={`/${locale}/dashboard/admin/users`}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Manage users
          </a>
          <button onClick={() => setShowCreate(prev => !prev)} disabled={!doctorRoleId} style={{ padding: '10px 14px' }}>
            {showCreate ? 'Close form' : '+ Add doctor'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          background: msg.startsWith('✅') ? '#f0fdf4' : msg.startsWith('⚠') ? '#fffbeb' : '#fef2f2',
          color: msg.startsWith('✅') ? '#166534' : msg.startsWith('⚠') ? '#92400e' : '#991b1b',
        }}>
          {msg}
        </div>
      )}

      {showCreate && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Create doctor account</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 18 }}>
            This creates a user login, assigns the doctor role, creates the doctor profile, and can also add a default weekly schedule.
          </div>

          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 18 }}>
              {[
                ['username', 'Username *'],
                ['fullName', 'Full name *'],
                ['email', 'Email *'],
                ['password', 'Password *'],
                ['title', 'Title'],
                ['licenseNumber', 'License number *'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{label}</label>
                  <input
                    type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                    value={String(form[key as keyof typeof INITIAL_FORM])}
                    onChange={e => setField(key as keyof typeof INITIAL_FORM, e.target.value as never)}
                    required={label.endsWith('*')}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Preferred language</label>
                <select value={form.preferredLanguage} onChange={e => setField('preferredLanguage', e.target.value)}>
                  <option value="en">English</option>
                  <option value="fa">فارسی</option>
                  <option value="ps">پښتو</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Specialty</label>
                <select
                  value={form.specialtyId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const specialty = specialties.find((row: any) => row.id === nextId);
                    setForm(prev => ({
                      ...prev,
                      specialtyId: nextId,
                      departmentId: prev.departmentId || specialty?.department_id || '',
                    }));
                  }}
                >
                  <option value="">Select specialty…</option>
                  {specialties.map((specialty: any) => (
                    <option key={specialty.id} value={specialty.id}>
                      {specialty.name}
                      {specialty.department_name ? ` — ${specialty.department_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Department</label>
                <select value={form.departmentId} onChange={e => setField('departmentId', e.target.value)}>
                  <option value="">Select department…</option>
                  {departments.map((department: any) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Consultation fee</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.consultationFee}
                  onChange={e => setField('consultationFee', e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>License expiry</label>
                <input
                  type="date"
                  value={form.licenseExpiresAt}
                  onChange={e => setField('licenseExpiresAt', e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Bio</label>
              <textarea value={form.bio} onChange={e => setField('bio', e.target.value)} rows={3} placeholder="Optional profile summary…" />
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginBottom: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, marginBottom: form.createSchedule ? 12 : 0 }}>
                <input
                  type="checkbox"
                  checked={form.createSchedule}
                  onChange={e => setField('createSchedule', e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Add a default weekly schedule
              </label>

              {form.createSchedule && (
                <>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                    Without a schedule, this doctor will not show bookable appointment slots.
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Working days</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {DAY_OPTIONS.map((day) => {
                        const selected = form.scheduleDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleScheduleDay(day.value)}
                            style={{
                              padding: '7px 12px',
                              borderRadius: 999,
                              border: `1px solid ${selected ? '#185FA5' : '#d1d5db'}`,
                              background: selected ? '#185FA5' : '#fff',
                              color: selected ? '#fff' : '#374151',
                              fontSize: 12,
                            }}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Start time</label>
                      <input type="time" value={form.scheduleStartTime} onChange={e => setField('scheduleStartTime', e.target.value)} required={form.createSchedule} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>End time</label>
                      <input type="time" value={form.scheduleEndTime} onChange={e => setField('scheduleEndTime', e.target.value)} required={form.createSchedule} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Slot duration (min)</label>
                      <input type="number" min="5" max="120" value={form.slotDuration} onChange={e => setField('slotDuration', e.target.value)} required={form.createSchedule} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Max patients per slot</label>
                      <input type="number" min="1" max="100" value={form.maxPatients} onChange={e => setField('maxPatients', e.target.value)} required={form.createSchedule} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Location</label>
                      <input value={form.location} onChange={e => setField('location', e.target.value)} placeholder="Clinic room, ward, etc." />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Effective from</label>
                      <input type="date" value={form.effectiveFrom} onChange={e => setField('effectiveFrom', e.target.value)} required={form.createSchedule} />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving || !doctorRoleId} style={{ padding: '10px 18px' }}>
                {saving ? 'Creating…' : 'Create doctor'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setForm({ ...INITIAL_FORM, effectiveFrom: todayIso() });
                }}
                style={{ padding: '10px 18px', background: '#f3f4f6', color: '#374151' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        keyField="id" loading={loading} rows={doctors} empty="No doctors found"
        columns={[
          { key: 'full_name', label: 'Name',
            render: r => <strong>{`${r.title} ${r.full_name}`}</strong> },
          { key: 'email', label: 'Email',
            render: r => <span style={{ fontSize: 12, color: '#6b7280' }}>{String(r.email ?? '—')}</span> },
          { key: 'license_number', label: 'License', width: '150px',
            render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(r.license_number)}</span> },
          { key: 'specialty_name', label: 'Specialty' },
          { key: 'department_name', label: 'Department' },
          { key: 'consultation_fee', label: 'Fee', width: '100px',
            render: r => `AFN ${Number(r.consultation_fee).toLocaleString()}` },
          { key: 'is_available', label: 'Status', width: '100px',
            render: r => <Badge label={r.is_available ? 'Available' : 'Unavailable'} preset={r.is_available ? 'success' : 'danger'} /> },
        ]}
      />
    </DashboardShell>
  );
}
