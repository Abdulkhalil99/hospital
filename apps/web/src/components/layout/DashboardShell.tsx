'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { clearSession, getSession, AuthUser } from '@/lib/auth';
import { useT, isRTL } from '@/lib/i18n';

interface NavItem { label: string; icon: string; path: string }

interface DashboardShellProps {
  children:  React.ReactNode;
  navItems:  NavItem[];
  title:     string;
  locale:    string;
}

const LOCALE_LABELS: Record<string, string> = { en: 'EN', fa: 'فا', ps: 'پښ' };

export function DashboardShell({ children, navItems, title, locale }: DashboardShellProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const t        = useT(locale);
  const rtl      = isRTL(locale);

  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push(`/${locale}`); return; }
    setUser(session.user);
  }, []);

  function logout() { clearSession(); router.push(`/${locale}`); }

  function switchLocale(next: string) {
    const newPath = pathname.replace(`/${locale}`, `/${next}`);
    router.push(newPath);
  }

  const sideW = collapsed ? 64 : 240;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: rtl ? 'rtl' : 'ltr' }}>

      {/* Sidebar */}
      <aside style={{
        width: sideW, background: '#fff', borderRight: rtl ? 'none' : '1px solid #e8e8e8',
        borderLeft: rtl ? '1px solid #e8e8e8' : 'none',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0,
        [rtl ? 'right' : 'left']: 0, transition: 'width .2s', zIndex: 100,
        boxShadow: rtl ? '-2px 0 8px rgba(0,0,0,.04)' : '2px 0 8px rgba(0,0,0,.04)',
      }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? '18px 12px' : '18px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>🏥</span>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#185FA5' }}>MediCore</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>HMS</div>
            </div>
          )}
          <button onClick={() => setCollapsed(p => !p)} style={{ background: 'none', color: '#bbb', border: 'none', padding: 4, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>
            {rtl ? (collapsed ? '←' : '→') : (collapsed ? '→' : '←')}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = pathname === item.path || pathname.startsWith(item.path + '/');
            return (
              <button key={item.path} onClick={() => router.push(item.path)} title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  textAlign: rtl ? 'right' : 'left',
                  justifyContent: collapsed ? 'center' : (rtl ? 'flex-end' : 'flex-start'),
                  flexDirection: rtl && !collapsed ? 'row-reverse' : 'row',
                  padding: collapsed ? '10px 0' : '9px 12px',
                  borderRadius: 8, marginBottom: 2,
                  background: active ? '#185FA518' : 'transparent',
                  color: active ? '#185FA5' : '#555',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13, border: 'none', transition: 'all .12s', cursor: 'pointer',
                }}>
                <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Locale switcher */}
        {!collapsed && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 4 }}>
            {['en','fa','ps'].map(loc => (
              <button key={loc} onClick={() => switchLocale(loc)}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 5,
                  background: locale === loc ? '#185FA5' : '#f0f0f0',
                  color:      locale === loc ? '#fff'    : '#555',
                  border: 'none', cursor: 'pointer', fontWeight: locale === loc ? 600 : 400,
                }}>
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>
        )}

        {/* User */}
        {user && (
          <div style={{ padding: collapsed ? '12px 8px' : '12px 14px', borderTop: '1px solid #f0f0f0' }}>
            {!collapsed && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 1, textAlign: rtl ? 'right' : 'left' }}>{user.username}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'capitalize', textAlign: rtl ? 'right' : 'left' }}>
                  {user.roles[0]?.replace('_', ' ')}
                </div>
              </>
            )}
            <button onClick={logout} style={{ width: '100%', background: '#f5f5f5', color: '#666', fontSize: 12, padding: '6px 0' }}>
              {collapsed ? '⬅' : t('nav.signout')}
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, [rtl ? 'marginRight' : 'marginLeft']: sideW, transition: 'margin .2s', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          background: '#fff', borderBottom: '1px solid #e8e8e8',
          padding: '14px 28px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50,
        }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: '#1a1a2e' }}>{title}</h1>
          <span style={{ fontSize: 12, color: '#aaa' }}>
            {formatDateHeader(locale)}
          </span>
        </header>

        <div style={{ padding: '24px 28px' }}>{children}</div>
      </main>
    </div>
  );
}

function formatDateHeader(locale: string): string {
  const now = new Date();
  if (locale === 'en') {
    return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  // Return Gregorian but with locale-aware day name
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
