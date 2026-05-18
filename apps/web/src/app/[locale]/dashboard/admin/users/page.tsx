'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, ADMIN_NAV } from '@/lib/nav';

export default function UsersPage({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(ADMIN_NAV, locale, t);
  const languageOptions = [
    { value: 'en', label: t('English'), native: 'English' },
    { value: 'fa', label: t('Persian'), native: 'فارسی' },
    { value: 'ps', label: t('Pashto'), native: 'پښتو' },
  ];

  const [users,   setUsers]   = useState<any[]>([]);
  const [roles,   setRoles]   = useState<any[]>([]);
  const [q,       setQ]       = useState('');
  const [loading, setLoading] = useState(true);
  const [selected,setSelected]= useState<any>(null);
  const [msg,     setMsg]     = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', fullName: '', preferredLanguage: 'en', roleIds: [] as string[] });

  useEffect(() => {
    Promise.all([loadUsers(), api.get<any[]>('/admin/roles')])
      .then(([, r]) => setRoles(r ?? []))
      .catch(() => {});
  }, [q]);

  async function loadUsers() {
    setLoading(true);
    const res = await api.get<any>(`/admin/users?q=${q}&limit=50`);
    setUsers(res.data ?? []);
    setLoading(false);
  }

  async function toggleActive(user: any) {
    await api.patch(`/admin/users/${user.id}`, { isActive: !user.is_active });
    loadUsers();
  }

  async function unlockUser(user: any) {
    await api.patch(`/admin/users/${user.id}`, { isLocked: false });
    setMsg(`✅ ${t('{{username}} unlocked', { username: user.username })}`);
    loadUsers();
    setTimeout(() => setMsg(''), 3000);
  }

  async function resetPw(userId: string, username: string) {
    const pw = prompt(t('New password for {{username}} (min 8 chars):', { username }));
    if (!pw || pw.length < 8) return;
    await api.post(`/admin/users/${userId}/reset-password`, { newPassword: pw });
    setMsg(`✅ ${t('Password reset for {{username}}', { username })}`);
    setTimeout(() => setMsg(''), 3000);
  }

  async function deleteUser(userId: string, username: string) {
    if (!confirm(t('Delete user {{username}}? This cannot be undone.', { username }))) return;
    await api.delete(`/admin/users/${userId}`);
    loadUsers();
  }

  async function assignRole(userId: string, roleId: string) {
    await api.post(`/admin/users/${userId}/roles`, { roleId });
    const u = await api.get<any>(`/admin/users/${userId}`);
    setSelected(u);
    loadUsers();
  }

  async function removeRole(userId: string, roleId: string) {
    await api.delete(`/admin/users/${userId}/roles/${roleId}`);
    const u = await api.get<any>(`/admin/users/${userId}`);
    setSelected(u);
    loadUsers();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      await api.post('/admin/users', newUser);
      setMsg(`✅ ${t('User created')}`);
      setShowCreate(false);
      setNewUser({ username: '', email: '', password: '', fullName: '', preferredLanguage: 'en', roleIds: [] });
      loadUsers();
    } catch (err: any) { setMsg(`❌ ${t(err.message)}`); }
  }

  return (
    <DashboardShell navItems={nav} title={t('User Management')} locale={locale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ flex: 1, maxWidth: 400 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search username, email, name…')} />
        </div>
        <button onClick={() => setShowCreate(p => !p)} style={{ marginLeft: 12 }}>
          {showCreate ? `✕ ${t('dash.cancel')}` : `+ ${t('Create user')}`}
        </button>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}

      {/* Create form */}
      {showCreate && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('Create new user')}</div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[['username','Username *'],['fullName','Full name *'],['email','Email *'],['password','Password *']].map(([k,l]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{t(l)}</label>
                  <input
                    type={k === 'password' ? 'password' : 'text'}
                    value={(newUser as any)[k]}
                    onChange={e => setNewUser(p => ({...p, [k]: e.target.value}))}
                    required
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{t('Language')}</label>
                <select value={newUser.preferredLanguage} onChange={e => setNewUser(p => ({...p, preferredLanguage: e.target.value}))}>
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label === option.native ? option.native : `${option.label} — ${option.native}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{t('Roles')}</label>
                <select multiple value={newUser.roleIds} onChange={e => setNewUser(p => ({...p, roleIds: Array.from(e.target.selectedOptions, o => o.value)}))} style={{ height: 80 }}>
                  {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit">{t('Create user')}</button>
          </form>
        </div>
      )}

      {/* Users table */}
      <DataTable
        keyField="id" loading={loading} rows={users} empty={t('No users found')}
        columns={[
          { key: 'username', label: t('Username'), render: r => <strong>{String(r.username)}</strong> },
          { key: 'full_name',label: t('Name') },
          { key: 'email',    label: t('Email'), render: r => <span style={{ fontSize: 12, color: '#888' }}>{String(r.email)}</span> },
          { key: 'roles',    label: t('Roles'),
            render: r => (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {((r.roles as string[]) ?? []).map((role, i) => (
                  <Badge key={i} label={role} preset="info" />
                ))}
              </div>
            )},
          { key: 'is_active', label: t('Status'), width: '100px',
            render: r => <Badge label={r.is_active ? t('Active') : t('Inactive')} preset={r.is_active ? 'success' : 'danger'} /> },
          { key: 'is_locked', label: t('Locked'), width: '80px',
            render: r => r.is_locked ? <Badge label={`🔒 ${t('Locked')}`} preset="warning" /> : null },
          { key: 'actions', label: '', width: '220px',
            render: r => (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setSelected(r)} style={{ fontSize: 11, padding: '3px 8px', background: '#f0f0f0', color: '#333' }}>{t('Roles')}</button>
                <button onClick={() => toggleActive(r)} style={{ fontSize: 11, padding: '3px 8px', background: r.is_active ? '#fef2f2' : '#f0fdf4', color: r.is_active ? '#991b1b' : '#166534' }}>
                  {r.is_active ? t('Deactivate') : t('Activate')}
                </button>
                {r.is_locked && <button onClick={() => unlockUser(r)} style={{ fontSize: 11, padding: '3px 8px', background: '#fffbeb', color: '#92400e' }}>{t('Unlock')}</button>}
                <button onClick={() => resetPw(String(r.id), String(r.username))} style={{ fontSize: 11, padding: '3px 8px', background: '#f0f0f0', color: '#333' }}>{t('Reset pw')}</button>
              </div>
            )},
        ]}
      />

      {/* Role assignment modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t('Roles')} — {selected.username}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', color: '#888', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t('Current roles')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {((selected.roles as string[]) ?? []).map((role: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eff6ff', padding: '4px 10px', borderRadius: 6 }}>
                    <span style={{ fontSize: 13, color: '#1d4ed8' }}>{role}</span>
                    <button onClick={() => {
                      const roleObj = roles.find((r: any) => r.name === role);
                      if (roleObj) removeRole(String(selected.id), roleObj.id);
                    }} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                  </div>
                ))}
                {((selected.roles as string[]) ?? []).length === 0 && <span style={{ fontSize: 13, color: '#aaa' }}>{t('No roles assigned')}</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t('Add role')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {roles
                  .filter((r: any) => !((selected.roles as string[]) ?? []).includes(r.name))
                  .map((r: any) => (
                    <button key={r.id} onClick={() => assignRole(String(selected.id), r.id)}
                      style={{ padding: '8px 12px', fontSize: 13, background: '#f8f9fa', color: '#333', border: '1px solid #e8e8e8', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                      + {r.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
