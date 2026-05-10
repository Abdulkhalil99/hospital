'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard } from '@/components/layout/StatCard';
import { DataTable } from '@/components/layout/DataTable';
import { Badge } from '@/components/layout/Badge';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { resolveNav, EMERGENCY_NAV } from '@/lib/nav';

function esiPreset(level: number) {
  if (level === 1) return 'danger';
  if (level === 2) return 'warning';
  if (level === 3) return 'info';
  if (level === 4) return 'success';
  return 'gray';
}

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(EMERGENCY_NAV, locale, t);

  const [board, setBoard] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [visitId, setVisitId] = useState('');
  const [bedId, setBedId] = useState('');
  const [notes, setNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [boardRows, availableBeds, dashboard] = await Promise.all([
        api.get<any[]>('/emergency/beds/board'),
        api.get<any[]>('/emergency/beds'),
        api.get<any>('/emergency/dashboard'),
      ]);
      setBoard(boardRows ?? []);
      setBeds(availableBeds ?? []);
      setVisits(dashboard?.visits ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, []);

  const availableOptions = beds.filter((bed) => bed.occupancy === 'available');
  const unassignedVisits = visits.filter((visit) => !visit.bed_id);
  const filteredBoard = board.filter((row) => {
    const matchesType = typeFilter === 'all' || String(row.bed_type ?? '') === typeFilter;
    const haystack = [
      row.bed_code,
      row.bed_type,
      row.location,
      row.patient_name,
      row.mrn,
      row.chief_complaint,
    ].join(' ').toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    return matchesType && matchesSearch;
  });

  async function assignBed(e: React.FormEvent) {
    e.preventDefault();
    if (!visitId || !bedId) return;
    setAssigning(true);
    setMsg('');
    try {
      await api.post('/emergency/beds/assign', {
        visitId,
        bedId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setMsg('Bed assigned successfully.');
      setVisitId('');
      setBedId('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to assign bed.');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <DashboardShell navItems={nav} title="Bed Management" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total beds" value={board.length} icon="🛏️" color="#185FA5" />
        <StatCard label="Available" value={board.filter((row) => !row.visit_id).length} icon="✅" color="#0F6E56" />
        <StatCard label="Occupied" value={board.filter((row) => !!row.visit_id).length} icon="🏥" color="#854F0B" />
        <StatCard label="Critical waiting" value={visits.filter((visit) => [1, 2].includes(Number(visit.triage_level)) && !visit.bed_id).length} icon="🚨" color="#991b1b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bed, location, patient, or complaint..."
              style={{ flex: 1 }}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 150 }}>
              <option value="all">All bed types</option>
              {Array.from(new Set(board.map((row) => String(row.bed_type ?? '')).filter(Boolean))).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <DataTable
            keyField="bed_id"
            loading={loading}
            rows={filteredBoard}
            empty="No bed rows found."
            columns={[
              {
                key: 'bed_code',
                label: 'Bed',
                width: '120px',
                render: (row) => (
                  <div>
                    <strong style={{ fontFamily: 'monospace', color: '#185FA5' }}>{String(row.bed_code ?? '—')}</strong>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{String(row.bed_status ?? 'active')}</div>
                  </div>
                ),
              },
              { key: 'bed_type', label: 'Type', width: '120px' },
              { key: 'location', label: 'Location' },
              {
                key: 'occupancy',
                label: 'Occupancy',
                width: '100px',
                render: (row) => row.visit_id
                  ? <Badge label="Occupied" preset="warning" />
                  : <Badge label="Available" preset="success" />,
              },
              {
                key: 'patient_name',
                label: 'Patient',
                render: (row) => row.patient_name
                  ? (
                    <div>
                      <strong>{String(row.patient_name)}</strong>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{String(row.mrn ?? '—')}</div>
                    </div>
                  )
                  : <span style={{ color: '#9ca3af' }}>Available</span>,
              },
              {
                key: 'chief_complaint',
                label: 'Clinical',
                render: (row) => (
                  row.visit_id
                    ? (
                      <div>
                        <div style={{ fontSize: 12 }}>{String(row.chief_complaint ?? '—')}</div>
                        <div style={{ marginTop: 4 }}>
                          {row.triage_level
                            ? <Badge label={`ESI ${row.triage_level}`} preset={esiPreset(Number(row.triage_level)) as any} />
                            : <Badge label="Untriaged" preset="gray" />}
                        </div>
                      </div>
                    )
                    : <span style={{ color: '#9ca3af' }}>—</span>
                ),
              },
              {
                key: 'minutes_in_ed',
                label: 'Time in ED',
                width: '100px',
                render: (row) => {
                  if (!row.minutes_in_ed) return <span style={{ color: '#9ca3af' }}>—</span>;
                  const minutes = Math.floor(Number(row.minutes_in_ed));
                  return <span style={{ color: minutes > 120 ? '#991b1b' : '#374151', fontWeight: minutes > 120 ? 600 : 400 }}>{minutes}m</span>;
                },
              },
            ]}
          />
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Assign bed</div>
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 14 }}>
            Assign unbedded ED patients into any currently available bed. Critical ESI 1-2 patients should be prioritized first.
          </div>

          <form onSubmit={assignBed} style={{ display: 'grid', gap: 10 }}>
            <select value={visitId} onChange={(e) => setVisitId(e.target.value)} required>
              <option value="">Select patient visit...</option>
              {unassignedVisits.map((visit) => (
                <option key={visit.id} value={visit.id}>
                  {visit.patient_name} · ESI {visit.triage_level ?? '—'} · {visit.chief_complaint}
                </option>
              ))}
            </select>

            <select value={bedId} onChange={(e) => setBedId(e.target.value)} required>
              <option value="">Select available bed...</option>
              {availableOptions.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.bed_code} · {bed.bed_type} · {bed.occupancy}
                </option>
              ))}
            </select>

            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Assignment notes (optional)"
            />

            <button type="submit" disabled={assigning || unassignedVisits.length === 0 || availableOptions.length === 0}>
              {assigning ? 'Assigning…' : 'Assign bed'}
            </button>
          </form>

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
