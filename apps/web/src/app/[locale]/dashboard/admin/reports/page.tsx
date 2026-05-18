'use client';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { DashboardShell }        from '@/components/layout/DashboardShell';
import { StatCard }              from '@/components/layout/StatCard';
import { DataTable }             from '@/components/layout/DataTable';
import { api }                   from '@/lib/api';
import { useT, isRTL, formatDate } from '@/lib/i18n';
import { resolveNav, ADMIN_NAV }   from '@/lib/nav';

const COLORS = ['#185FA5','#0F6E56','#854F0B','#991b1b','#3C3489','#5F5E5A'];

const STATUS_COLOR: Record<string,string> = {
  completed: '#0F6E56', scheduled: '#185FA5', confirmed: '#185FA5',
  cancelled: '#991b1b', no_show: '#888', checked_in: '#854F0B',
};

function formatCurrencyTooltip(value: unknown, label: string): [string, string] {
  return [`AFN ${Number(value ?? 0).toLocaleString()}`, label];
}

function formatMinutesTooltip(value: unknown, label: string): [string, string] {
  return [`${Number(value ?? 0)} min`, label];
}

function renderAppointmentStatusLabel(props: any) {
  const status = String(props?.payload?.status ?? '');
  const percent = Number(props?.percent ?? 0);
  return `${status} ${(percent * 100).toFixed(0)}%`;
}

export default function ReportsPage({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const rtl = isRTL(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [kpi,        setKpi]        = useState<any>(null);
  const [revenue,    setRevenue]    = useState<any[]>([]);
  const [patients,   setPatients]   = useState<any[]>([]);
  const [apptStatus, setApptStatus] = useState<any[]>([]);
  const [topDocs,    setTopDocs]    = useState<any[]>([]);
  const [emergency,  setEmergency]  = useState<any[]>([]);
  const [drugs,      setDrugs]      = useState<any[]>([]);
  const [outstanding,setOutstanding]= useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [days,       setDays]       = useState(30);
  const [activeTab,  setActiveTab]  = useState<'overview'|'revenue'|'clinical'|'pharmacy'|'emergency'>('overview');

  useEffect(() => { load(); }, [days]);

  async function load() {
    setLoading(true);
    try {
      const [k, rev, pat, appt, docs, em, dr, out] = await Promise.all([
        api.get<any>('/reports/kpi'),
        api.get<any[]>(`/reports/revenue?days=${days}`),
        api.get<any[]>(`/reports/patients?days=${days}`),
        api.get<any[]>('/reports/appointments'),
        api.get<any[]>('/reports/doctors'),
        api.get<any[]>('/reports/emergency'),
        api.get<any[]>('/reports/drugs'),
        api.get<any[]>('/reports/outstanding'),
      ]);
      setKpi(k); setRevenue(rev ?? []); setPatients(pat ?? []);
      setApptStatus(appt ?? []); setTopDocs(docs ?? []);
      setEmergency(em ?? []); setDrugs(dr ?? []); setOutstanding(out ?? []);
    } finally { setLoading(false); }
  }

  const card = { background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px', marginBottom: 20 } as const;
  const chartTitle = { fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 16 } as const;

  const TABS = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'revenue',   label: 'Revenue'   },
    { id: 'clinical',  label: 'Clinical'  },
    { id: 'pharmacy',  label: 'Pharmacy'  },
    { id: 'emergency', label: 'Emergency' },
  ] as const;

  return (
    <DashboardShell navItems={nav} title="Reports & Analytics" locale={locale}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: 6 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13, borderRadius: 7, border: 'none',
              background: activeTab === tab.id ? '#185FA5' : 'transparent',
              color:      activeTab === tab.id ? '#fff'    : '#555',
              fontWeight: activeTab === tab.id ? 600       : 400, cursor: 'pointer',
            }}>
            {t(tab.label)}
          </button>
        ))}

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{
                padding: '8px 12px', fontSize: 12, borderRadius: 7, border: 'none', cursor: 'pointer',
                background: days === d ? '#185FA518' : 'transparent',
                color:      days === d ? '#185FA5'   : '#888',
                fontWeight: days === d ? 600          : 400,
              }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ─────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* KPI cards */}
          {kpi && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
              <StatCard label="Total patients"      value={kpi.patients.total}                              icon="👥" color="#185FA5" sub={`+${kpi.patients.newToday} ${t('dash.today')}`} />
              <StatCard label="Available doctors"   value={`${kpi.doctors.available}/${kpi.doctors.total}`} icon="👨‍⚕️" color="#0F6E56" />
              <StatCard label="Appts today"         value={kpi.appointments.today}                          icon="📅" color="#3C3489" sub={`${kpi.appointments.completed} ${t('completed')}`} />
              <StatCard label="Revenue today"       value={`AFN ${Number(kpi.revenue.today).toLocaleString()}`} icon="💰" color="#0F6E56" sub={`${t('Month')}: ${Number(kpi.revenue.month).toLocaleString()}`} />
              <StatCard label="Active ED visits"    value={kpi.emergency.active}                            icon="🚨" color="#991b1b" sub={`${kpi.emergency.level1Today} ESI-1 ${t('dash.today')}`} />
              <StatCard label="Pending lab orders"  value={kpi.lab.pending}                                 icon="🧪" color="#854F0B" sub={`${kpi.lab.criticalAlerts} critical`} />
            </div>
          )}

          {/* Revenue trend */}
          <div style={card}>
            <div style={chartTitle}>{t('Revenue — last {{days}} days (AFN)', { days })}</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#185FA5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
                <Tooltip formatter={(value) => formatCurrencyTooltip(value, 'Revenue')} labelFormatter={l => `Date: ${l}`} />
                <Area type="monotone" dataKey="revenue" stroke="#185FA5" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Patients + Appointment status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <div style={chartTitle}>{t('New patients per day')}</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={patients}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0F6E56" radius={[4,4,0,0]} name="Patients" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={card}>
              <div style={chartTitle}>{t('Appointments by status (30d)')}</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={apptStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={renderAppointmentStatusLabel} labelLine={false} fontSize={11}>
                    {apptStatus.map((s,i) => <Cell key={i} fill={STATUS_COLOR[s.status] ?? COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [String(value ?? '—'), String(name ?? 'Status')]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ── REVENUE ──────────────────────────────────── */}
      {activeTab === 'revenue' && (
        <>
          <div style={card}>
            <div style={chartTitle}>{t('Daily revenue and transactions')}</div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="r2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#185FA5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis yAxisId="left"  tick={{ fontSize: 11 }} tickFormatter={v => 'AFN '+(v/1000).toFixed(0)+'k'} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [
                  name === 'revenue' ? `AFN ${Number(value ?? 0).toLocaleString()}` : String(value ?? 0),
                  name === 'revenue' ? 'Revenue' : 'Transactions',
                ]} />
                <Legend />
                <Area yAxisId="left"  type="monotone" dataKey="revenue"      stroke="#185FA5" fill="url(#r2)" strokeWidth={2} name="revenue" />
                <Area yAxisId="right" type="monotone" dataKey="transactions" stroke="#0F6E56" fill="none"      strokeWidth={2} name="transactions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={card}>
            <div style={chartTitle}>{t('Outstanding invoices by age')}</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={outstanding} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => 'AFN '+(v/1000).toFixed(0)+'k'} />
                <YAxis type="category" dataKey="age_bucket" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(value) => formatCurrencyTooltip(value, 'Balance')} />
                <Bar dataKey="total_balance" fill="#991b1b" radius={[0,4,4,0]} name="Balance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ── CLINICAL ─────────────────────────────────── */}
      {activeTab === 'clinical' && (
        <>
          <div style={card}>
            <div style={chartTitle}>{t('Top doctors by appointments (30d)')}</div>
            <DataTable
              keyField="full_name" loading={loading} rows={topDocs} empty="No data"
              columns={[
                { key: 'full_name',    label: 'Doctor', render: r => <strong>{String(r.full_name)}</strong> },
                { key: 'specialty',    label: 'Specialty' },
                { key: 'appointments', label: 'Appointments', width: '130px',
                  render: r => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#185FA5' }}>{String(r.appointments)}</span> },
                { key: 'completed',    label: 'Completed', width: '110px',
                  render: r => <span style={{ color: '#0F6E56' }}>{String(r.completed)}</span> },
                { key: 'revenue',      label: 'Revenue', width: '140px',
                  render: r => `AFN ${Number(r.revenue).toLocaleString()}` },
              ]}
            />
          </div>
        </>
      )}

      {/* ── PHARMACY ─────────────────────────────────── */}
      {activeTab === 'pharmacy' && (
        <>
          <div style={card}>
            <div style={chartTitle}>{t('Top dispensed drugs (30d)')}</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={drugs} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="generic_name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip />
                <Bar dataKey="dispense_count" fill="#0F6E56" radius={[0,4,4,0]} name="Dispense count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ── EMERGENCY ────────────────────────────────── */}
      {activeTab === 'emergency' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <div style={chartTitle}>{t('Visits by ESI level (30d)')}</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={emergency}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="level" tickFormatter={l => `ESI ${l}`} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={l => `ESI ${l}`} />
                  <Bar dataKey="count" radius={[4,4,0,0]} name="Visits">
                    {emergency.map((_,i) => (
                      <Cell key={i} fill={['#991b1b','#ea580c','#ca8a04','#16a34a','#2563eb'][i] ?? '#888'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={card}>
              <div style={chartTitle}>{t('Average time in ED by ESI (minutes)')}</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={emergency} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="level" tickFormatter={l => `ESI ${l}`} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip labelFormatter={l => `ESI ${l}`} formatter={(value) => formatMinutesTooltip(value, 'Avg time')} />
                  <Bar dataKey="avgMinutes" fill="#185FA5" radius={[0,4,4,0]} name="Avg minutes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

    </DashboardShell>
  );
}
