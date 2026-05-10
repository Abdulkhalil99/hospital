'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { StatCard }            from '@/components/layout/StatCard';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, PHARMACY_NAV } from '@/lib/nav';

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(PHARMACY_NAV, locale, t);

  const [inventory, setInventory] = useState<any[]>([]);
  const [drugs, setDrugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    drugId: '',
    location: 'main_pharmacy',
    batchNumber: '',
    quantity: '1',
    expiryDate: '',
    purchasePrice: '',
    sellingPrice: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const [inventoryRows, drugRows] = await Promise.all([
        api.get<any[]>('/pharmacy/inventory'),
        api.get<any[]>('/pharmacy/drugs'),
      ]);
      setInventory(inventoryRows ?? []);
      setDrugs(drugRows ?? []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = inventory.filter((row) => {
    const text = `${row.generic_name ?? ''} ${row.strength ?? ''} ${row.location ?? ''} ${row.batch_number ?? ''}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  });

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');

    try {
      await api.post('/pharmacy/inventory', {
        drugId: form.drugId,
        location: form.location,
        batchNumber: form.batchNumber || undefined,
        quantity: Number(form.quantity),
        expiryDate: form.expiryDate || undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : undefined,
      });
      setMsg('Stock added successfully.');
      setForm({
        drugId: '',
        location: 'main_pharmacy',
        batchNumber: '',
        quantity: '1',
        expiryDate: '',
        purchasePrice: '',
        sellingPrice: '',
      });
      loadData();
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to add stock.');
    }
  }

  return (
    <DashboardShell navItems={nav} title="Inventory" locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Inventory lines" value={inventory.length} icon="📦" color="#185FA5" />
        <StatCard label="Visible rows" value={filtered.length} icon="📋" color="#0F6E56" />
        <StatCard label="Low stock" value={inventory.filter((row) => Number(row.quantity_on_hand) <= Number(row.reorder_level)).length} icon="⚠️" color="#854F0B" />
        <StatCard label="Controlled drugs" value={inventory.filter((row) => row.is_controlled).length} icon="🔐" color="#991b1b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Search inventory</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drug, strength, location, or batch..."
          />
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add stock</div>
          <form onSubmit={addStock}>
            <div style={{ display: 'grid', gap: 10 }}>
              <select value={form.drugId} onChange={(e) => setForm((current) => ({ ...current, drugId: e.target.value }))} required>
                <option value="">Select drug...</option>
                {drugs.map((drug) => (
                  <option key={drug.id} value={drug.id}>
                    {drug.generic_name} {drug.strength ? `- ${drug.strength}` : ''}
                  </option>
                ))}
              </select>
              <input value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} placeholder="Location" required />
              <input value={form.batchNumber} onChange={(e) => setForm((current) => ({ ...current, batchNumber: e.target.value }))} placeholder="Batch number" />
              <input type="number" min="1" value={form.quantity} onChange={(e) => setForm((current) => ({ ...current, quantity: e.target.value }))} placeholder="Quantity" required />
              <input type="date" value={form.expiryDate} onChange={(e) => setForm((current) => ({ ...current, expiryDate: e.target.value }))} />
              <input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => setForm((current) => ({ ...current, purchasePrice: e.target.value }))} placeholder="Purchase price" />
              <input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => setForm((current) => ({ ...current, sellingPrice: e.target.value }))} placeholder="Selling price" />
              <button type="submit">Add stock</button>
            </div>
          </form>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          background: msg.toLowerCase().includes('failed') ? '#fef2f2' : '#f0fdf4',
          color: msg.toLowerCase().includes('failed') ? '#991b1b' : '#166534',
        }}>
          {msg}
        </div>
      )}

      <DataTable
        keyField="id"
        loading={loading}
        rows={filtered}
        empty="No inventory records found."
        columns={[
          { key: 'generic_name', label: 'Drug', render: (row) => <strong>{String(row.generic_name ?? '—')}</strong> },
          { key: 'strength', label: 'Strength', width: '110px' },
          { key: 'location', label: 'Location', width: '140px' },
          { key: 'batch_number', label: 'Batch', width: '140px' },
          {
            key: 'quantity_on_hand',
            label: 'On hand',
            width: '100px',
            render: (row) => <strong style={{ color: Number(row.quantity_on_hand) <= Number(row.reorder_level) ? '#991b1b' : '#166534' }}>{String(row.quantity_on_hand ?? 0)}</strong>,
          },
          { key: 'reorder_level', label: 'Reorder', width: '100px' },
          {
            key: 'expiry_date',
            label: 'Expiry',
            width: '120px',
            render: (row) => row.expiry_date ? String(row.expiry_date).slice(0, 10) : '—',
          },
          {
            key: 'flags',
            label: 'Flags',
            width: '150px',
            render: (row) => (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {row.is_controlled && <Badge label="Controlled" preset="danger" />}
                {Number(row.quantity_on_hand) <= Number(row.reorder_level) && <Badge label="Low stock" preset="warning" />}
              </div>
            ),
          },
        ]}
      />
    </DashboardShell>
  );
}
