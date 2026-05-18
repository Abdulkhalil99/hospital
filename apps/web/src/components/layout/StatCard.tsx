'use client';
import { useParams } from 'next/navigation';
import { useT } from '@/lib/i18n';

interface StatCardProps {
  label:    string;
  value:    string | number;
  icon:     string;
  color?:   string;
  sub?:     string;
  onClick?: () => void;
}

export function StatCard({ label, value, icon, color = '#185FA5', sub, onClick }: StatCardProps) {
  const params = useParams<{ locale?: string }>();
  const locale = typeof params?.locale === 'string' ? params.locale : 'en';
  const t = useT(locale);

  return (
    <div
      onClick={onClick}
      style={{
        background:   '#fff',
        borderRadius: 10,
        border:       '1px solid #e8e8e8',
        padding:      '18px 20px',
        display:      'flex',
        alignItems:   'center',
        gap:          14,
        cursor:       onClick ? 'pointer' : 'default',
        transition:   'box-shadow .12s',
        boxShadow:    '0 1px 4px rgba(0,0,0,.05)',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: color + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{t(label)}</div>
        {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{t(sub)}</div>}
      </div>
    </div>
  );
}
