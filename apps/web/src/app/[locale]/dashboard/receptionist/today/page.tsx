'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, RECEPTIONIST_NAV } from '@/lib/nav';

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(RECEPTIONIST_NAV, locale, t);
  const today = new Date().toISOString().split('T')[0];

  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<any>(`/appointments?date=${today}&limit=100`)
      .then((res) => {
        setAppointments(res.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [today]);

  const filtered = appointments.filter((appt) => {
    const matchesStatus = status === 'all' || appt.status === status;
    const haystack = `${appt.patient_name ?? ''} ${appt.patient_mrn ?? ''} ${appt.doctor_name ?? ''}`.toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  });

  async function checkin(appointmentId: string) {
    try {
      const res = await api.post<any>(`/appointments/${appointmentId}/checkin`, {});
      setMsg(`Checked in ${res.token?.token_display ?? 'patient'} successfully.`);
      const refreshed = await api.get<any>(`/appointments?date=${today}&limit=100`);
      setAppointments(refreshed.data ?? []);
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to check in patient.');
    }
  }

  return (
    <DashboardShell navItems={nav} title="Today List" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total today" value={appointments.length} icon="📋" color="#185FA5" />
        <StatCard label="Scheduled" value={appointments.filter((a) => a.status === 'scheduled').length} icon="📅" color="#854F0B" />
        <StatCard label="Checked in" value={appointments.filter((a) => a.status === 'checked_in').length} icon="✅" color="#0F6E56" />
        <StatCard label="Completed" value={appointments.filter((a) => a.status === 'completed').length} icon="🏁" color="#6b7280" />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient, MRN, or doctor..."
          style={{ flex: 1 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 180 }}>
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked in</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No show</option>
        </select>
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

      <DataTable
        keyField="id"
        loading={loading}
        rows={filtered}
        empty="No appointments found for today."
        columns={[
          {
            key: 'scheduled_start',
            label: 'Time',
            width: '90px',
            render: (row) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(row.scheduled_start ?? '').slice(0, 5)}</span>,
          },
          {
            key: 'patient_name',
            label: 'Patient',
            render: (row) => <strong>{String(row.patient_name ?? '—')}</strong>,
          },
          {
            key: 'patient_mrn',
            label: 'MRN',
            width: '130px',
            render: (row) => <span style={{ fontFamily: 'monospace', color: '#185FA5' }}>{String(row.patient_mrn ?? '—')}</span>,
          },
          { key: 'doctor_name', label: 'Doctor' },
          {
            key: 'scheduled_date',
            label: 'Date',
            width: '120px',
            render: (row) => formatDate(String(row.scheduled_date ?? today), locale),
          },
          {
            key: 'status',
            label: 'Status',
            width: '110px',
            render: (row) => {
              const current = String(row.status ?? 'unknown');
              const preset =
                current === 'completed' ? 'success'
                : current === 'checked_in' ? 'warning'
                : current === 'cancelled' || current === 'no_show' ? 'danger'
                : 'info';
              return <Badge label={current} preset={preset as any} />;
            },
          },
          {
            key: 'action',
            label: '',
            width: '110px',
            render: (row) => (
              row.status === 'scheduled' || row.status === 'confirmed'
                ? <button onClick={() => checkin(String(row.id))} style={{ fontSize: 12, padding: '5px 12px' }}>Check in</button>
                : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
            ),
          },
        ]}
      />
    </DashboardShell>
  );
}
