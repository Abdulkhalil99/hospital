'use client';
import { useState, useEffect } from 'react';
import { useRouter }            from 'next/navigation';
import { api }                  from '@/lib/api';
import { saveSession, getDashboardPath, getSession, UserRole } from '@/lib/auth';
import { useT, isRTL }          from '@/lib/i18n';

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  const router   = useRouter();
  const t        = useT(locale);
  const rtl      = isRTL(locale);

  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('Admin@123456');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => {
    setMounted(true);
    const session = getSession();
    if (session?.accessToken) {
      router.replace(getDashboardPath(session.user.roles, locale));
    }
  }, []);

  if (!mounted) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', { username, password });
      const me  = await api.get<{
        id: string;
        username: string;
        mustChangePassword: boolean;
        roles: UserRole[];
        permissions: string[];
      }>('/auth/me', res.accessToken);

      const user = {
        id:                 me.id,
        username:           me.username,
        mustChangePassword: me.mustChangePassword,
        roles:              me.roles,
        permissions:        me.permissions,
      };

      saveSession({ accessToken: res.accessToken, refreshToken: res.refreshToken, user });
      router.replace(getDashboardPath(user.roles, locale));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.invalidCredentials'));
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #185FA5 0%, #0F6E56 100%)', direction: rtl ? 'rtl' : 'ltr' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '40px 36px', width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>🏥</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#185FA5', marginBottom: 4 }}>MediCore HMS</h1>
          <p style={{ fontSize: 13, color: '#888' }}>Hospital Management System</p>
        </div>

        {/* Locale switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, justifyContent: 'center' }}>
          {[['en','English'],['fa','فارسی'],['ps','پښتو']].map(([loc, label]) => (
            <a key={loc} href={`/${loc}`} style={{
              padding: '4px 14px', borderRadius: 6, fontSize: 13, border: '1px solid',
              borderColor: locale === loc ? '#185FA5' : '#ddd',
              background:  locale === loc ? '#185FA5' : '#fff',
              color:       locale === loc ? '#fff'    : '#555',
              textDecoration: 'none',
            }}>
              {label}
            </a>
          ))}
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, textAlign: rtl ? 'right' : 'left' }}>
              {t('auth.username')}
            </label>
            <input value={username} onChange={e => setUsername(e.target.value)} required autoFocus style={{ textAlign: rtl ? 'right' : 'left' }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, textAlign: rtl ? 'right' : 'left' }}>
              {t('auth.password')}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ textAlign: rtl ? 'right' : 'left' }} />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 16, textAlign: rtl ? 'right' : 'left' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px 0', fontSize: 15, borderRadius: 8 }}>
            {loading ? t('dash.loading') : t('auth.loginButton')}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: '12px 14px', background: '#f0f7ff', borderRadius: 8, fontSize: 12, color: '#555', lineHeight: 1.7, textAlign: rtl ? 'right' : 'left' }}>
          superadmin / Admin@123456
        </div>
      </div>
    </div>
  );
}
