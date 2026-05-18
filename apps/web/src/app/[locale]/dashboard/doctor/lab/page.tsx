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

function statusPreset(status: string) {
  if (status === 'resulted') return 'success';
  if (status === 'processing' || status === 'sample_collected') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'info';
}

function urgencyPreset(urgency: string) {
  if (urgency === 'stat') return 'danger';
  if (urgency === 'urgent') return 'warning';
  return 'info';
}

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t = useT(locale);
  const nav = resolveNav(DOCTOR_NAV, locale, t);
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [urgency, setUrgency] = useState('all');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const doctor = await api.get<any>('/doctors/me');
        const encounters = await api.get<any[]>(`/emr/doctor/${doctor.id}?date=${date}`);
        const fullEncounters = await Promise.all(
          (encounters ?? []).map((encounter) => api.get<any>(`/emr/${encounter.id}/full`)),
        );

        const nextOrders = fullEncounters
          .flatMap((full) => (full.labOrders ?? []).map((order: any) => ({
            ...order,
            encounter_id: full.encounter.id,
            patient_name: full.encounter.patient_name,
            patient_mrn: full.encounter.patient_mrn,
            chief_complaint: full.encounter.chief_complaint,
            encounter_status: full.encounter.status,
          })))
          .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

        setOrders(nextOrders);
      } finally {
        setLoading(false);
      }
    }

    load().catch(() => setLoading(false));
  }, [date]);

  const filtered = orders.filter((order) => {
    const matchesUrgency = urgency === 'all' || order.urgency === urgency;
    const matchesStatus = status === 'all' || order.status === status;
    const haystack = [
      order.patient_name,
      order.patient_mrn,
      order.test_name,
      order.test_code,
      order.chief_complaint,
    ].join(' ').toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    return matchesUrgency && matchesStatus && matchesSearch;
  });

  return (
    <DashboardShell navItems={nav} title={t('nav.lab')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label={t('Total orders')} value={orders.length} icon="🧪" color="#185FA5" />
        <StatCard label="STAT" value={orders.filter((order) => order.urgency === 'stat').length} icon="⚡" color="#991b1b" />
        <StatCard label={t('Urgent')} value={orders.filter((order) => order.urgency === 'urgent').length} icon="⏳" color="#854F0B" />
        <StatCard label={t('Resulted')} value={orders.filter((order) => order.status === 'resulted').length} icon="✅" color="#0F6E56" />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Search patient, MRN, test, or complaint...')}
          style={{ flex: 1 }}
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
        <select value={urgency} onChange={(e) => setUrgency(e.target.value)} style={{ width: 130 }}>
          <option value="all">{t('All urgency')}</option>
          <option value="routine">{t('Routine')}</option>
          <option value="urgent">{t('Urgent')}</option>
          <option value="stat">STAT</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 170 }}>
          <option value="all">{t('All status')}</option>
          <option value="ordered">{t('Ordered')}</option>
          <option value="sample_collected">{t('Sample collected')}</option>
          <option value="processing">{t('Processing')}</option>
          <option value="resulted">{t('Resulted')}</option>
          <option value="cancelled">{t('cancelled')}</option>
        </select>
      </div>

      <DataTable
        keyField="id"
        loading={loading}
        rows={filtered}
        empty={t('No lab orders found for the selected date.')}
        columns={[
          {
            key: 'created_at',
            label: t('Ordered'),
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
            label: t('dash.patient'),
            render: (row) => (
              <div>
                <strong>{String(row.patient_name ?? '—')}</strong>
                {row.chief_complaint && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {String(row.chief_complaint)}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'patient_mrn',
            label: t('dash.mrn'),
            width: '130px',
            render: (row) => <span style={{ fontFamily: 'monospace', color: '#185FA5' }}>{String(row.patient_mrn ?? '—')}</span>,
          },
          {
            key: 'test_name',
            label: t('Test'),
            render: (row) => (
              <div>
                <strong>{String(row.test_name ?? '—')}</strong>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{String(row.test_code ?? t('No code'))}</div>
              </div>
            ),
          },
          {
            key: 'urgency',
            label: t('dash.urgency'),
            width: '100px',
            render: (row) => <Badge label={t(String(row.urgency ?? 'routine'))} preset={urgencyPreset(String(row.urgency ?? 'routine')) as any} />,
          },
          {
            key: 'status',
            label: t('dash.status'),
            width: '140px',
            render: (row) => <Badge label={t(String(row.status ?? 'ordered'))} preset={statusPreset(String(row.status ?? 'ordered')) as any} />,
          },
          {
            key: 'encounter_status',
            label: t('Encounter'),
            width: '120px',
            render: (row) => <Badge label={t(String(row.encounter_status ?? 'open'))} preset={row.encounter_status === 'completed' ? 'success' : 'info'} />,
          },
          {
            key: 'action',
            label: '',
            width: '110px',
            render: (row) => (
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
                {t('Open EMR')}
              </Link>
            ),
          },
        ]}
      />
    </DashboardShell>
  );
}
