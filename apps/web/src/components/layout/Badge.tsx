'use client';

const PRESETS = {
  success: { bg: '#f0fdf4', color: '#166534' },
  warning: { bg: '#fffbeb', color: '#92400e' },
  danger:  { bg: '#fef2f2', color: '#991b1b' },
  info:    { bg: '#eff6ff', color: '#1d4ed8' },
  gray:    { bg: '#f9fafb', color: '#6b7280' },
  purple:  { bg: '#faf5ff', color: '#6b21a8' },
} as const;

interface BadgeProps {
  label:   string;
  preset?: keyof typeof PRESETS;
  bg?:     string;
  color?:  string;
}

export function Badge({ label, preset = 'gray', bg, color }: BadgeProps) {
  const style = bg && color ? { bg, color } : PRESETS[preset];
  return (
    <span style={{
      display:      'inline-block',
      padding:      '2px 8px',
      borderRadius: 4,
      fontSize:     11,
      fontWeight:   600,
      background:   style.bg,
      color:        style.color,
      whiteSpace:   'nowrap',
    }}>
      {label}
    </span>
  );
}
