'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function SettingsPage({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);

  const [settings, setSettings] = useState<any>({});
  const [flags,    setFlags]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');
  const [tab,      setTab]      = useState<'hospital'|'flags'>('hospital');

  useEffect(() => {
    Promise.all([
      api.get<any>('/admin/settings'),
      api.get<any[]>('/admin/flags'),
    ]).then(([s, f]) => {
      setSettings(s ?? {}); setFlags(f ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.patch('/admin/settings', settings);
      setMsg('✅ Settings saved');
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
    setSaving(false);
  }

  async function toggleFlag(key: string, current: boolean) {
    await api.patch(`/admin/flags/${key}`, { isEnabled: !current });
    setFlags(prev => prev.map(f => f.flag_key === key ? { ...f, is_enabled: !current } : f));
  }

  const set = (k: string, v: unknown) => setSettings((p: any) => ({ ...p, [k]: v }));

  const field = (label: string, key: string, type = 'text') => (
    <div key={key}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#555' }}>{label}</label>
      <input type={type} value={settings[key] ?? ''} onChange={e => set(key, e.target.value)} />
    </div>
  );

  if (loading) return (
    <DashboardShell navItems={nav} title="Settings" locale={locale}>
      <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div>
    </DashboardShell>
  );

  return (
    <DashboardShell navItems={nav} title="Hospital Settings" locale={locale}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: 6 }}>
        {[['hospital','Hospital settings'],['flags','Feature flags']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            style={{ flex: 1, padding: '8px 0', fontSize: 13, borderRadius: 7, border: 'none', cursor: 'pointer', background: tab === id ? '#185FA5' : 'transparent', color: tab === id ? '#fff' : '#555', fontWeight: tab === id ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Hospital settings */}
      {tab === 'hospital' && (
        <form onSubmit={saveSettings}>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Identity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {field('Hospital name (EN)', 'hospital_name')}
              {field('Hospital name (FA)', 'hospital_name_fa')}
              {field('Hospital name (PS)', 'hospital_name_ps')}
              {field('Phone', 'phone', 'tel')}
              {field('Email', 'email', 'email')}
              {field('Website', 'website')}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Address</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {field('Address (EN)', 'address')}
              {field('Address (FA)', 'address_fa')}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Regional settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Default language</label>
                <select value={settings.default_language ?? 'fa'} onChange={e => set('default_language', e.target.value)}>
                  <option value="en">English</option>
                  <option value="fa">فارسی</option>
                  <option value="ps">پښتو</option>
                </select>
              </div>
              {field('Currency', 'default_currency')}
              {field('Timezone', 'timezone')}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '22px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Clinical rules</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {field('Work start time', 'work_start_time', 'time')}
              {field('Work end time', 'work_end_time', 'time')}
              {field('Default slot (minutes)', 'default_slot_minutes', 'number')}
              {field('Max advance booking (days)', 'max_advance_booking_days', 'number')}
              {field('EMR lock after (hours)', 'emr_lock_after_hours', 'number')}
              {field('Tax rate (%)', 'tax_rate_percent', 'number')}
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!settings.friday_closed} onChange={e => set('friday_closed', e.target.checked)} />
                Friday is closed (no appointments)
              </label>
            </div>
          </div>

          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}

          <button type="submit" disabled={saving} style={{ padding: '10px 28px' }}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}

      {/* Feature flags */}
      {tab === 'flags' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
          {flags.map((f: any, i: number) => (
            <div key={f.flag_key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: i < flags.length - 1 ? '1px solid #f5f5f5' : 'none',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{f.flag_key}</div>
                {f.description && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{f.description}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: f.is_enabled ? '#166534' : '#991b1b', fontWeight: 500 }}>
                  {f.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
                <div
                  onClick={() => toggleFlag(f.flag_key, f.is_enabled)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative',
                    background: f.is_enabled ? '#0F6E56' : '#e0e0e0',
                    transition: 'background .2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: f.is_enabled ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
