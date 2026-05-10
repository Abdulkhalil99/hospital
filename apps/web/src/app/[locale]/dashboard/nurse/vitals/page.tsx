'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard } from '@/components/layout/StatCard';
import { DataTable } from '@/components/layout/DataTable';
import { Badge } from '@/components/layout/Badge';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { resolveNav, NURSE_NAV } from '@/lib/nav';

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(NURSE_NAV, locale, t);
  const today = new Date().toISOString().split('T')[0];

  const [appointments, setAppointments] = useState<any[]>([]);
  const [encounterMap, setEncounterMap] = useState<Record<string, any>>({});
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [selectedVitals, setSelectedVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({
    temperatureC: '',
    bpSystolic: '',
    bpDiastolic: '',
    pulseBpm: '',
    respiratoryRate: '',
    o2Saturation: '',
    weightKg: '',
    heightCm: '',
    bloodGlucose: '',
    notes: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const appointmentResponse = await api.get<any>(`/appointments?date=${today}&status=checked_in&limit=100`);
      const rows = appointmentResponse.data ?? [];
      setAppointments(rows);

      const doctorIds = Array.from(new Set(rows.map((row: any) => row.doctor_id).filter(Boolean)));
      const encounterLists = await Promise.all(
        doctorIds.map((doctorId) => api.get<any[]>(`/emr/doctor/${doctorId}?date=${today}`)),
      );
      const nextMap: Record<string, any> = {};
      encounterLists.flat().forEach((encounter) => {
        if (encounter.appointment_id) {
          nextMap[String(encounter.appointment_id)] = encounter;
        }
      });
      setEncounterMap(nextMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, [today]);

  useEffect(() => {
    async function loadVitals() {
      if (!selectedAppointmentId) {
        setSelectedVitals([]);
        return;
      }
      const encounter = encounterMap[selectedAppointmentId];
      if (!encounter?.id) {
        setSelectedVitals([]);
        return;
      }
      try {
        const vitals = await api.get<any[]>(`/emr/${encounter.id}/vitals`);
        setSelectedVitals(vitals ?? []);
      } catch {
        setSelectedVitals([]);
      }
    }

    loadVitals().catch(() => setSelectedVitals([]));
  }, [selectedAppointmentId, encounterMap]);

  const filteredAppointments = appointments.filter((appointment) => {
    const haystack = [
      appointment.patient_name,
      appointment.patient_mrn,
      appointment.doctor_name,
      appointment.notes,
    ].join(' ').toLowerCase();
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  });

  const selectedAppointment = appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null;
  const selectedEncounter = selectedAppointment ? encounterMap[selectedAppointment.id] : null;

  async function saveVitals(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAppointment) return;

    setSaving(true);
    setMsg('');

    try {
      let encounterId = selectedEncounter?.id as string | undefined;

      if (!encounterId) {
        const encounter = await api.post<any>('/emr', {
          patientId: selectedAppointment.patient_id,
          doctorId: selectedAppointment.doctor_id,
          appointmentId: selectedAppointment.id,
          encounterType: 'outpatient',
          ...(selectedAppointment.notes ? { chiefComplaint: selectedAppointment.notes } : {}),
        });
        encounterId = encounter.id;
        setEncounterMap((prev) => ({
          ...prev,
          [selectedAppointment.id]: encounter,
        }));
      }

      const payload = Object.fromEntries(
        Object.entries(form)
          .filter(([key, value]) => key === 'notes' ? String(value).trim() !== '' : value !== '')
          .map(([key, value]) => key === 'notes' ? [key, value] : [key, Number(value)]),
      );

      await api.post(`/emr/${encounterId}/vitals`, payload);
      const vitals = await api.get<any[]>(`/emr/${encounterId}/vitals`);
      setSelectedVitals(vitals ?? []);
      setForm({
        temperatureC: '',
        bpSystolic: '',
        bpDiastolic: '',
        pulseBpm: '',
        respiratoryRate: '',
        o2Saturation: '',
        weightKg: '',
        heightCm: '',
        bloodGlucose: '',
        notes: '',
      });
      setMsg('Vitals saved successfully.');
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to save vitals.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell navItems={nav} title="Vital Signs" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Checked in" value={appointments.length} icon="💓" color="#185FA5" />
        <StatCard label="Encounter started" value={Object.keys(encounterMap).length} icon="📝" color="#0F6E56" />
        <StatCard label="Awaiting start" value={Math.max(appointments.length - Object.keys(encounterMap).length, 0)} icon="⏳" color="#854F0B" />
        <StatCard label="Selected history" value={selectedVitals.length} icon="📈" color="#991b1b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, MRN, doctor, or notes..."
            />
          </div>

          <DataTable
            keyField="id"
            loading={loading}
            rows={filteredAppointments}
            empty="No patients are waiting for vitals."
            columns={[
              {
                key: 'patient_name',
                label: 'Patient',
                render: (row) => (
                  <button
                    onClick={() => setSelectedAppointmentId(String(row.id))}
                    style={{
                      background: selectedAppointmentId === row.id ? '#185FA5' : '#f8fafc',
                      color: selectedAppointmentId === row.id ? '#fff' : '#111827',
                      padding: '6px 10px',
                      fontSize: 12,
                    }}
                  >
                    {String(row.patient_name ?? '—')}
                  </button>
                ),
              },
              {
                key: 'patient_mrn',
                label: 'MRN',
                width: '130px',
                render: (row) => <span style={{ fontFamily: 'monospace', color: '#185FA5' }}>{String(row.patient_mrn ?? '—')}</span>,
              },
              { key: 'doctor_name', label: 'Doctor' },
              {
                key: 'scheduled_start',
                label: 'Time',
                width: '90px',
                render: (row) => <span style={{ fontFamily: 'monospace' }}>{String(row.scheduled_start ?? '').slice(0, 5)}</span>,
              },
              {
                key: 'encounter',
                label: 'Encounter',
                width: '110px',
                render: (row) => encounterMap[row.id]
                  ? <Badge label="Started" preset="success" />
                  : <Badge label="Not started" preset="gray" />,
              },
            ]}
          />
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          {!selectedAppointment ? (
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Select a patient from the list to start or continue a vitals chart.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedAppointment.patient_name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  MRN {selectedAppointment.patient_mrn} · {selectedAppointment.doctor_name} · {String(selectedAppointment.scheduled_start ?? '').slice(0, 5)}
                </div>
                <div style={{ marginTop: 8 }}>
                  {selectedEncounter
                    ? <Badge label="Encounter started" preset="success" />
                    : <Badge label="Encounter will start on first save" preset="warning" />}
                </div>
              </div>

              {selectedVitals.length > 0 && (
                <div style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 8, background: '#f8fafc' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recent vitals</div>
                  {selectedVitals.slice(0, 3).map((vital, index) => (
                    <div key={index} style={{ fontSize: 12, color: '#4b5563', padding: '6px 0', borderTop: index > 0 ? '1px solid #e5e7eb' : 'none' }}>
                      {new Date(String(vital.recorded_at)).toLocaleString(locale)} — T:{vital.temperature_c ?? '—'} BP:{vital.bp_systolic ?? '—'}/{vital.bp_diastolic ?? '—'} HR:{vital.pulse_bpm ?? '—'} O2:{vital.o2_saturation ?? '—'}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={saveVitals}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  {[
                    ['temperatureC', 'Temperature (°C)'],
                    ['bpSystolic', 'BP systolic'],
                    ['bpDiastolic', 'BP diastolic'],
                    ['pulseBpm', 'Pulse'],
                    ['respiratoryRate', 'Respiratory rate'],
                    ['o2Saturation', 'O2 saturation %'],
                    ['weightKg', 'Weight (kg)'],
                    ['heightCm', 'Height (cm)'],
                    ['bloodGlucose', 'Blood glucose'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>{label}</label>
                      <input type="number" value={(form as any)[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Notes</label>
                  <textarea rows={3} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional nursing notes..." />
                </div>

                <button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save vitals'}
                </button>
              </form>
            </>
          )}

          {msg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              marginTop: 16,
              fontSize: 13,
              background: msg.toLowerCase().includes('failed') ? '#fef2f2' : '#f0fdf4',
              color: msg.toLowerCase().includes('failed') ? '#991b1b' : '#166534',
            }}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
