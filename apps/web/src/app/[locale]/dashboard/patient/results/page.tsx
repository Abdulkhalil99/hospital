'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, PATIENT_NAV } from '@/lib/nav';

const FLAG_PRESET: Record<string, 'danger'|'warning'|'success'|'info'|'gray'> = {
  HH: 'danger', LL: 'danger', H: 'warning', L: 'info', N: 'success',
};

export default function MyLabResults({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(PATIENT_NAV, locale, t);

  const [results,  setResults]  = useState<any[]>([]);
  const [grouped,  setGrouped]  = useState<Record<string, any[]>>({});
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get<any[]>('/portal/lab-results')
      .then(r => {
        const all = r ?? [];
        setResults(all);
        // Group by test_name + date
        const g: Record<string, any[]> = {};
        all.forEach((row: any) => {
          const key = `${row.test_name}__${row.entered_at?.slice(0,10) ?? ''}`;
          if (!g[key]) g[key] = [];
          g[key].push(row);
        });
        setGrouped(g);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <DashboardShell navItems={nav} title={t('nav.myresults')} locale={locale}>
      <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{t('dash.loading')}</div>
    </DashboardShell>
  );

  if (results.length === 0) return (
    <DashboardShell navItems={nav} title={t('nav.myresults')} locale={locale}>
      <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
        <div>{t('No lab results available yet.')}</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>{t('Results appear here after your doctor releases them.')}</div>
      </div>
    </DashboardShell>
  );

  return (
    <DashboardShell navItems={nav} title={t('nav.myresults')} locale={locale}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(grouped).map(([key, rows]) => {
          const first      = rows[0];
          const isExpanded = expanded === key;
          const hasCritical= rows.some((r: any) => r.is_critical);

          return (
            <div key={key} style={{
              background: '#fff', borderRadius: 10,
              border: `1px solid ${hasCritical ? '#fca5a5' : '#e8e8e8'}`,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div
                onClick={() => setExpanded(isExpanded ? null : key)}
                style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, background: hasCritical ? '#fef2f2' : '#fff' }}
              >
                <span style={{ fontSize: 20 }}>🧪</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{first.test_name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {formatDate(first.entered_at, locale)} ·
                    {t('dash.barcode')}: <span style={{ fontFamily: 'monospace' }}>{first.barcode}</span> ·
                    {t('dash.doctor')}: {first.ordered_by_name}
                  </div>
                </div>
                {hasCritical && <Badge label={`⚠ ${t('Critical')}`} preset="danger" />}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
                  {rows.map((r: any, i: number) => (
                    r.flag && <Badge key={i} label={r.flag} preset={FLAG_PRESET[r.flag] ?? 'gray'} />
                  ))}
                </div>
                <span style={{ color: '#aaa', fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Components */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f0f0f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {[t('dash.component'), t('dash.result'), t('dash.unit'), t('Normal range'), t('dash.flag')].map(h => (
                          <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r: any, i: number) => (
                        <tr key={i} style={{ background: r.is_critical ? '#fef2f220' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 500 }}>{r.component_name}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 700, color: r.is_critical ? '#991b1b' : '#333', fontSize: 15 }}>{r.result_value}</td>
                          <td style={{ padding: '10px 16px', color: '#888' }}>{r.unit ?? '—'}</td>
                          <td style={{ padding: '10px 16px', color: '#888', fontSize: 12 }}>
                            {r.normal_min != null && r.normal_max != null ? `${r.normal_min} – ${r.normal_max}` : '—'}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            {r.flag ? <Badge label={r.flag} preset={FLAG_PRESET[r.flag] ?? 'gray'} /> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}
