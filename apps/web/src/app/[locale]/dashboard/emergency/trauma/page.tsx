'use client';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { StatCard } from '@/components/layout/StatCard';
import { DataTable } from '@/components/layout/DataTable';
import { Badge } from '@/components/layout/Badge';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { resolveNav, EMERGENCY_NAV } from '@/lib/nav';

function levelPreset(level: string) {
  if (level === 'level_1') return 'danger';
  if (level === 'level_2') return 'warning';
  return 'info';
}

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(EMERGENCY_NAV, locale, t);

  const [visits, setVisits] = useState<any[]>([]);
  const [activations, setActivations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitId, setVisitId] = useState('');
  const [activationLevel, setActivationLevel] = useState('level_2');
  const [mechanism, setMechanism] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [dashboard, traumaRows] = await Promise.all([
        api.get<any>('/emergency/dashboard'),
        api.get<any[]>('/emergency/trauma'),
      ]);
      setVisits(dashboard?.visits ?? []);
      setActivations(traumaRows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, []);

  const filtered = activations.filter((activation) => {
    const matchesLevel = levelFilter === 'all' || activation.activation_level === levelFilter;
    const haystack = [
      activation.patient_name,
      activation.chief_complaint,
      activation.mechanism,
      activation.activated_by_name,
    ].join(' ').toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    return matchesLevel && matchesSearch;
  });

  async function activateTrauma(e: React.FormEvent) {
    e.preventDefault();
    if (!visitId || !mechanism.trim()) return;
    setSaving(true);
    setMsg('');
    try {
      await api.post('/emergency/trauma', {
        visitId,
        activationLevel,
        mechanism: mechanism.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setMsg('Trauma activation sent successfully.');
      setVisitId('');
      setActivationLevel('level_2');
      setMechanism('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to activate trauma.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell navItems={nav} title="Trauma Activation" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Activations" value={activations.length} icon="⚡" color="#185FA5" />
        <StatCard label="Level 1" value={activations.filter((row) => row.activation_level === 'level_1').length} icon="🚨" color="#991b1b" />
        <StatCard label="Level 2" value={activations.filter((row) => row.activation_level === 'level_2').length} icon="⏳" color="#854F0B" />
        <StatCard label="Active ED visits" value={visits.length} icon="🏥" color="#0F6E56" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20, alignItems: 'start', marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Activate trauma protocol</div>
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 14 }}>
            Use this when the ED needs immediate mobilization. The activation is broadcast across connected clinical dashboards.
          </div>

          <form onSubmit={activateTrauma} style={{ display: 'grid', gap: 10 }}>
            <select value={visitId} onChange={(e) => setVisitId(e.target.value)} required>
              <option value="">Select active visit...</option>
              {visits.map((visit) => (
                <option key={visit.id} value={visit.id}>
                  {visit.patient_name} · ESI {visit.triage_level ?? '—'} · {visit.chief_complaint}
                </option>
              ))}
            </select>

            <select value={activationLevel} onChange={(e) => setActivationLevel(e.target.value)}>
              <option value="level_1">Level 1</option>
              <option value="level_2">Level 2</option>
              <option value="level_3">Level 3</option>
            </select>

            <input
              value={mechanism}
              onChange={(e) => setMechanism(e.target.value)}
              placeholder="Mechanism of injury or activation reason"
              required
            />

            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes (optional)"
            />

            <button type="submit" disabled={saving || visits.length === 0}>
              {saving ? 'Activating…' : 'Activate trauma'}
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

        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, mechanism, or responder..."
              style={{ flex: 1 }}
            />
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} style={{ width: 130 }}>
              <option value="all">All levels</option>
              <option value="level_1">Level 1</option>
              <option value="level_2">Level 2</option>
              <option value="level_3">Level 3</option>
            </select>
          </div>

          <DataTable
            keyField="id"
            loading={loading}
            rows={filtered}
            empty="No trauma activations recorded."
            columns={[
              {
                key: 'activated_at',
                label: 'Activated',
                width: '150px',
                render: (row) => (
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {new Date(String(row.activated_at)).toLocaleString(locale)}
                  </span>
                ),
              },
              {
                key: 'activation_level',
                label: 'Level',
                width: '100px',
                render: (row) => <Badge label={String(row.activation_level ?? 'level_2').replace('_', ' ').toUpperCase()} preset={levelPreset(String(row.activation_level ?? 'level_2')) as any} />,
              },
              {
                key: 'patient_name',
                label: 'Patient',
                render: (row) => (
                  <div>
                    <strong>{String(row.patient_name ?? '—')}</strong>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{String(row.chief_complaint ?? '—')}</div>
                  </div>
                ),
              },
              { key: 'mechanism', label: 'Mechanism' },
              { key: 'activated_by_name', label: 'Activated by' },
            ]}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
