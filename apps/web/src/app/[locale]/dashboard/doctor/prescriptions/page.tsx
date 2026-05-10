'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard } from '@/components/layout/StatCard';
import { DataTable } from '@/components/layout/DataTable';
import { Badge } from '@/components/layout/Badge';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { resolveNav, DOCTOR_NAV } from '@/lib/nav';

function prescriptionPreset(status: string) {
  if (status === 'dispensed' || status === 'partial') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'warning';
}

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(DOCTOR_NAV, locale, t);
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [msg, setMsg] = useState('');

  async function load(selectedDate = date) {
    setLoading(true);
    try {
      const doctor = await api.get<any>('/doctors/me');
      const encounters = await api.get<any[]>(`/emr/doctor/${doctor.id}?date=${selectedDate}`);
      const fullEncounters = await Promise.all(
        (encounters ?? []).map((encounter) => api.get<any>(`/emr/${encounter.id}/full`)),
      );

      const nextRows = fullEncounters
        .flatMap((full) => (full.prescriptions ?? []).map((prescription: any) => ({
          ...prescription,
          encounter_id: full.encounter.id,
          patient_name: full.encounter.patient_name,
          patient_mrn: full.encounter.patient_mrn,
          chief_complaint: full.encounter.chief_complaint,
        })))
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

      setPrescriptions(nextRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(date).catch(() => setLoading(false));
  }, [date]);

  async function cancelPrescription(encounterId: string, prescriptionId: string) {
    if (!window.confirm('Cancel this pending prescription?')) return;
    setMsg('');
    try {
      await api.post(`/emr/${encounterId}/prescriptions/${prescriptionId}/cancel`, {});
      setMsg('Prescription cancelled successfully.');
      await load(date);
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to cancel prescription.');
    }
  }

  const filtered = prescriptions.filter((prescription) => {
    const matchesStatus = status === 'all' || prescription.status === status;
    const haystack = [
      prescription.patient_name,
      prescription.patient_mrn,
      prescription.drug_name,
      prescription.generic_name,
      prescription.instructions,
      prescription.chief_complaint,
    ].join(' ').toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardShell navItems={nav} title="My Prescriptions" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total today" value={prescriptions.length} icon="💊" color="#185FA5" />
        <StatCard label="Pending" value={prescriptions.filter((row) => row.status === 'pending').length} icon="⏳" color="#854F0B" />
        <StatCard label="Dispensed" value={prescriptions.filter((row) => row.status === 'dispensed' || row.status === 'partial').length} icon="✅" color="#0F6E56" />
        <StatCard label="Controlled" value={prescriptions.filter((row) => row.is_controlled).length} icon="🛡️" color="#991b1b" />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient, MRN, drug, or instructions..."
          style={{ flex: 1 }}
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="dispensed">Dispensed</option>
          <option value="partial">Partial</option>
          <option value="cancelled">Cancelled</option>
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
        empty="No prescriptions found for the selected date."
        columns={[
          {
            key: 'created_at',
            label: 'Issued',
            width: '120px',
            render: (row) => (
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {new Date(String(row.created_at)).toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ),
          },
          {
            key: 'patient_name',
            label: 'Patient',
            render: (row) => (
              <div>
                <strong>{String(row.patient_name ?? '—')}</strong>
                {row.chief_complaint && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{String(row.chief_complaint)}</div>
                )}
              </div>
            ),
          },
          {
            key: 'patient_mrn',
            label: 'MRN',
            width: '130px',
            render: (row) => <span style={{ fontFamily: 'monospace', color: '#185FA5' }}>{String(row.patient_mrn ?? '—')}</span>,
          },
          {
            key: 'drug_name',
            label: 'Medication',
            render: (row) => (
              <div>
                <strong>{String(row.drug_name ?? '—')}</strong>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {String(row.generic_name ?? row.dosage ?? '—')}
                </div>
              </div>
            ),
          },
          {
            key: 'frequency',
            label: 'Sig',
            render: (row) => (
              <div style={{ fontSize: 12 }}>
                <div>{String(row.dosage ?? '—')}</div>
                <div style={{ color: '#6b7280', marginTop: 2 }}>{String(row.frequency ?? '—')} · {String(row.route ?? 'oral')}</div>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            width: '110px',
            render: (row) => <Badge label={String(row.status ?? 'pending')} preset={prescriptionPreset(String(row.status ?? 'pending')) as any} />,
          },
          {
            key: 'is_controlled',
            label: 'Control',
            width: '100px',
            render: (row) => row.is_controlled ? <Badge label="Controlled" preset="danger" /> : <Badge label="Standard" preset="gray" />,
          },
          {
            key: 'action',
            label: '',
            width: '190px',
            render: (row) => (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Link
                  href={`/${locale}/dashboard/doctor/emr/${row.encounter_id}`}
                  style={{
                    display: 'inline-block',
                    padding: '5px 12px',
                    borderRadius: 6,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Open EMR
                </Link>
                {row.status === 'pending' ? (
                  <button
                    onClick={() => cancelPrescription(String(row.encounter_id), String(row.id))}
                    style={{ fontSize: 12, padding: '5px 12px', background: '#fef2f2', color: '#991b1b' }}
                  >
                    Cancel
                  </button>
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: 12, alignSelf: 'center' }}>—</span>
                )}
              </div>
            ),
          },
        ]}
      />
    </DashboardShell>
  );
}
