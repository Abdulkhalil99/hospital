'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';

const NAV = [
  { label: 'Invoices',     icon: '📄', path: '/dashboard/billing' },
  { label: 'Payments',     icon: '💳', path: '/dashboard/billing/payments' },
  { label: 'Outstanding',  icon: '⏳', path: '/dashboard/billing/outstanding' },
  { label: 'Daily report', icon: '📊', path: '/dashboard/billing/report' },
];

export default function PaymentsPage({ params: { locale } }: { params: { locale: string } }) {
  const nav = NAV.map(n => ({ ...n, path: `/${locale}${n.path}` }));

  const [search,   setSearch]   = useState('');
  const [invoice,  setInvoice]  = useState<any>(null);
  const [amount,   setAmount]   = useState('');
  const [method,   setMethod]   = useState('cash');
  const [reference,setReference]= useState('');
  const [msg,      setMsg]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    api.get<any>('/billing?status=issued&limit=30')
      .then(r => setInvoices(r.data ?? []));
  }, []);

  async function selectInvoice(id: string) {
    const data = await api.get<any>(`/billing/${id}`);
    setInvoice(data);
    setAmount(String(data.invoice.balance_due));
    setMsg('');
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      const res = await api.post<any>(`/billing/${invoice.invoice.id}/payments`, {
        amount: Number(amount), paymentMethod: method,
        referenceNumber: reference || undefined,
      });
      setMsg(`✅ Payment recorded. Receipt: ${res.receipt?.receipt_number}`);
      setInvoice(null); setAmount(''); setReference('');
      const updated = await api.get<any>('/billing?status=issued&limit=30');
      setInvoices(updated.data ?? []);
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
    setLoading(false);
  }

  return (
    <DashboardShell navItems={nav} title="Record Payment" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Invoice list */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Select invoice</div>
          <div style={{ marginBottom: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient name…" />
          </div>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
            {invoices.filter((inv: any) => !search || inv.patient_name?.toLowerCase().includes(search.toLowerCase())).map((inv: any) => (
              <div
                key={inv.id}
                onClick={() => selectInvoice(inv.id)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                  background: invoice?.invoice?.id === inv.id ? '#f0f7ff' : '#fff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#185FA5', fontWeight: 600 }}>{inv.invoice_number}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{inv.patient_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>AFN {Number(inv.balance_due).toLocaleString()}</div>
                  <Badge label={inv.status} preset="info" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment form */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Record payment</div>
          {!invoice ? (
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              Select an invoice from the list
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
              <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f0f7ff', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{invoice.invoice.invoice_number}</div>
                <div style={{ fontSize: 13, color: '#555' }}>{invoice.invoice.patient_name}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
                  <span>Total: <strong>AFN {Number(invoice.invoice.total_amount).toLocaleString()}</strong></span>
                  <span>Paid: <strong style={{ color: '#166534' }}>AFN {Number(invoice.invoice.paid_amount).toLocaleString()}</strong></span>
                  <span>Balance: <strong style={{ color: '#991b1b' }}>AFN {Number(invoice.invoice.balance_due).toLocaleString()}</strong></span>
                </div>
              </div>

              <form onSubmit={handlePayment}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Amount *</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="0.01" step="0.01" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Payment method</label>
                  <select value={method} onChange={e => setMethod(e.target.value)}>
                    {['cash','card','bank_transfer','insurance','mobile_pay','other'].map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Reference number</label>
                  <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Card/transfer reference…" />
                </div>
                {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#166534' : '#991b1b' }}>{msg}</div>}
                <button type="submit" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Processing…' : `Record payment — AFN ${Number(amount || 0).toLocaleString()}`}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
