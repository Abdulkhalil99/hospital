'use client';

interface Column<T> {
  key:     string;
  label:   string;
  render?: (row: T) => React.ReactNode;
  width?:  string;
}

interface DataTableProps<T> {
  columns:  Column<T>[];
  rows:     T[];
  loading?: boolean;
  empty?:   string;
  keyField: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, rows, loading, empty = 'No data found', keyField,
}: DataTableProps<T>) {
  if (loading) return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: 40, textAlign: 'center', color: '#aaa' }}>
      Loading…
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {columns.map(col => (
                <th key={col.key} style={{
                  padding: '11px 16px', textAlign: 'left', fontSize: 12,
                  fontWeight: 600, color: '#555', borderBottom: '1px solid #eee',
                  whiteSpace: 'nowrap', width: col.width,
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
                  {empty}
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={String(row[keyField] ?? i)} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f5f5f5' }}>
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
