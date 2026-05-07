'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { DataTable }       from '@/components/layout/DataTable';
import { Badge }           from '@/components/layout/Badge';
import { api }             from '@/lib/api';

const NAV = [
  { label: 'My Queue',      icon: '📋', path: '/dashboard/doctor' },
  { label: 'Appointments',  icon: '📅', path: '/dashboard/doctor/appointments' },
  { label: 'Patients',      icon: '👥', path: '/dashboard/doctor/patients' },
  { label: 'EMR',           icon: '📝', path: '/dashboard/doctor/emr' },
  { label: 'Prescriptions', icon: '💊', path: '/dashboard/doctor/prescriptions' },
  { label: 'Lab Orders',    icon: '🧪', path: '/dashboard/doctor/lab' },
];

export default function DoctorPatients({ params: { locale } }: { params: { locale: string } }) {
  const nav = NAV.map(n => ({ ...n, path: `/${locale}${n.path}` }));

  const [patients, setPatients] = useState<any[]>([]);
  const [q,        setQ]        = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/patients?q=${q}&limit=30`)
      .then(r => { setPatients(r.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [q]);

  return (
    <DashboardShell navItems={nav} title="Patients" locale={locale}>
      <div style={{ marginBottom: 16 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, MRN, phone…" />
      </div>
      <DataTable
        keyField="id" loading={loading} rows={patients} empty="No patients found"
        columns={[
          { key: 'mrn', label: 'MRN', width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#185FA5', fontWeight: 600 }}>{String(r.mrn)}</span> },
          { key: 'first_name', label: 'Name', render: r => <strong>{`${r.first_name} ${r.last_name}`}</strong> },
          { key: 'date_of_birth', label: 'DOB', width: '120px',
            render: r => r.date_of_birth ? new Date(String(r.date_of_birth)).toLocaleDateString() : '—' },
          { key: 'gender', label: 'Gender', width: '90px',
            render: r => <Badge label={String(r.gender)} preset="info" /> },
          { key: 'blood_type', label: 'Blood', width: '80px' },
          { key: 'phone', label: 'Phone' },
          { key: 'has_allergies', label: 'Allergy', width: '90px',
            render: r => r.has_allergies ? <Badge label="⚠ Yes" preset="danger" /> : <Badge label="None" preset="gray" /> },
        ]}
      />
    </DashboardShell>
  );
}
