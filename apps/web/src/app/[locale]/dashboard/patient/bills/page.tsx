'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT, formatDate }    from '@/lib/i18n';
import { resolveNav, PATIENT_NAV } from '@/lib/nav';

export default function MyBills({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(PATIENT_NAV, locale, t);

  const [invoices,  setInvoices]  = useState<any[]>([]);
  const [detail,    setDetail]    = useState<any>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    api.get<any[]>('/portal/invoices')
      .then(r => { setInvoices(r ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function openDetail(id: string) {
    const d = await api.get<any>(`/portal/invoices/${id}`);
    setDetail(d);
  }

  const totalOutstanding = invoices
    .filter((inv: any) => ['issued','partial'].includes(inv.status))
    .reduce((s: number, inv: any) => s + Number(inv.balance_due ?? 0), 0);

  return (
    <DashboardShell navItems={nav} title={t('nav.mybills')} locale={locale}>

      {totalOutstanding > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b' }}>Outstanding balance</div>
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>Please visit the cashier to settle your account</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#991b1b' }}>
            AFN {totalOutstanding.toLocaleString()}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{t('dash.loading')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {invoices.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
              <div>No invoices found</div>
            </div>
          )}
          {invoices.map((inv: any) => (
            <div key={inv.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: '#185FA5' }}>{inv.invoice_number}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {formatDate(inv.issued_at ?? inv.created_at, locale)}
                    {inv.due_date && ` · Due: ${formatDate(inv.due_date, locale)}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>AFN {Number(inv.total_amount).toLocaleString()}</div>
                    {Number(inv.balance_due) > 0 && (
                      <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                        Balance: AFN {Number(inv.balance_due).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <Badge
                    label={inv.status}
                    preset={inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : inv.status === 'cancelled' ? 'gray' : 'danger'}
                  />
                  <button onClick={() => openDetail(inv.id)} style={{ fontSize: 12, padding: '5px 14px', background: '#f0f0f0', color: '#333' }}>
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invoice detail modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#185FA5' }}>{detail.invoice.invoice_number}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{formatDate(detail.invoice.issued_at ?? detail.invoice.created_at, locale)}</div>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Items</div>
              {detail.items.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                  <span>{item.description}</span>
                  <span style={{ fontWeight: 600 }}>AFN {Number(item.line_total ?? item.unit_price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              {[
                ['Subtotal',  detail.invoice.subtotal],
                ['Discount',  detail.invoice.discount_amount],
                ['Total',     detail.invoice.total_amount],
                ['Paid',      detail.invoice.paid_amount],
                ['Balance due', detail.invoice.balance_due],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', fontWeight: String(label) === 'Balance due' ? 700 : 400, color: String(label) === 'Balance due' && Number(value) > 0 ? '#991b1b' : '#333' }}>
                  <span>{label}</span>
                  <span>AFN {Number(value).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Payments */}
            {detail.payments.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Payments received</div>
                {detail.payments.map((p: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                    <div>
                      <span style={{ textTransform: 'capitalize' }}>{p.payment_method.replace('_',' ')}</span>
                      {p.receipt_number && <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{p.receipt_number}</span>}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: '#166534' }}>AFN {Number(p.amount).toLocaleString()}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#aaa' }}>{formatDate(p.received_at, locale)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
