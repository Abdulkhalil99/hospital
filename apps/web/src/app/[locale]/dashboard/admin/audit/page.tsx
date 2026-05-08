'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function AuditPage({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [logs,    setLogs]    = useState<any[]>([]);
  const [security,setSecurity]= useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'audit'|'security'>('audit');
  const [filters, setFilters] = useState({ tableName: '', from: '', to: '' });

  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([,v]) => v))
    ).toString();
    const [a, s] = await Promise.all([
      api.get<any>(`/admin/audit?limit=100&${qs}`),
      api.get<any[]>('/admin/security-events?limit=100'),
    ]);
    setLogs(a.data ?? []); setSecurity(s ?? []);
    setLoading(false);
  }

  const ACTION_COLORS: Record<string, 'success'|'warning'|'danger'|'info'> = {
    INSERT: 'success', UPDATE: 'warning', DELETE: 'danger', SELECT: 'info',
  };

  return (
    <DashboardShell navItems={nav} title="Audit Logs" locale={locale}>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: 6 }}>
        {[['audit','Audit logs'],['security','Security events']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            style={{ flex: 1, padding: '8px 0', fontSize: 13, borderRadius: 7, border: 'none', cursor: 'pointer', background: tab === id ? '#185FA5' : 'transparent', color: tab === id ? '#fff' : '#555', fontWeight: tab === id ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'audit' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input value={filters.tableName} onChange={e => setFilters(p => ({...p, tableName: e.target.value}))} placeholder="Table name…" style={{ width: 200 }} />
            <input type="date" value={filters.from} onChange={e => setFilters(p => ({...p, from: e.target.value}))} style={{ width: 'auto' }} />
            <input type="date" value={filters.to}   onChange={e => setFilters(p => ({...p, to:   e.target.value}))} style={{ width: 'auto' }} />
            <button onClick={() => setFilters({ tableName: '', from: '', to: '' })} style={{ background: '#f0f0f0', color: '#555', padding: '8px 14px', fontSize: 13 }}>Clear</button>
          </div>

          <DataTable
            keyField="id" loading={loading} rows={logs} empty="No audit logs"
            columns={[
              { key: 'created_at', label: 'Time', width: '160px',
                render: r => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{new Date(String(r.created_at)).toLocaleString()}</span> },
              { key: 'username',   label: 'User', width: '130px',
                render: r => <strong>{String(r.username ?? '—')}</strong> },
              { key: 'action',     label: 'Action', width: '80px',
                render: r => <Badge label={String(r.action)} preset={ACTION_COLORS[String(r.action)] ?? 'gray'} /> },
              { key: 'table_name', label: 'Table',
                render: r => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#185FA5' }}>{String(r.table_name)}</span> },
              { key: 'record_id',  label: 'Record ID', width: '200px',
                render: r => <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{String(r.record_id ?? '—').slice(0,18)}…</span> },
            ]}
          />
        </>
      )}

      {tab === 'security' && (
        <DataTable
          keyField="id" loading={loading} rows={security} empty="No security events"
          columns={[
            { key: 'created_at', label: 'Time', width: '160px',
              render: r => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{new Date(String(r.created_at)).toLocaleString()}</span> },
            { key: 'username',   label: 'User', width: '130px',
              render: r => <strong>{String(r.username ?? '—')}</strong> },
            { key: 'event_type', label: 'Event',
              render: r => <Badge label={String(r.event_type ?? '—')} preset={String(r.event_type).includes('fail') || String(r.event_type).includes('lock') ? 'danger' : 'info'} /> },
            { key: 'ip_address', label: 'IP', width: '130px',
              render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(r.ip_address ?? '—')}</span> },
            { key: 'details',    label: 'Details',
              render: r => <span style={{ fontSize: 12, color: '#888' }}>{JSON.stringify(r.details ?? {}).slice(0,60)}</span> },
          ]}
        />
      )}
    </DashboardShell>
  );
}
