'use client';
import { useEffect, useState } from 'react';
import { DashboardShell }      from '@/components/layout/DashboardShell';
import { DataTable }           from '@/components/layout/DataTable';
import { Badge }               from '@/components/layout/Badge';
import { api }                 from '@/lib/api';
import { useT }                from '@/lib/i18n';
import { resolveNav, PHARMACY_NAV } from '@/lib/nav';

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  const t   = useT(locale);
  const nav = resolveNav(PHARMACY_NAV, locale, t);

  const [pending, setPending] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [quantityDispensed, setQuantityDispensed] = useState('1');
  const [witnessId, setWitnessId] = useState('');
  const [notes, setNotes] = useState('');
  const [overrideAllergyWarning, setOverrideAllergyWarning] = useState(false);
  const [overrideInteractionWarning, setOverrideInteractionWarning] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [pendingRows, inventoryRows] = await Promise.all([
        api.get<any[]>('/pharmacy/prescriptions/pending'),
        api.get<any[]>('/pharmacy/inventory'),
      ]);
      setPending(pendingRows ?? []);
      setInventory(inventoryRows ?? []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedPrescription = pending.find((row) => row.id === selectedPrescriptionId) ?? null;
  const matchingInventory = selectedPrescription
    ? inventory.filter((row) => {
      const names = [selectedPrescription.generic_name, selectedPrescription.drug_name]
        .filter(Boolean)
        .map((name: string) => name.toLowerCase());
      return names.length === 0 || names.some((name: string) => String(row.generic_name ?? '').toLowerCase().includes(name));
    })
    : [];

  const inventoryOptions = matchingInventory.length > 0 ? matchingInventory : inventory;
  const selectedInventory = inventory.find((row) => row.id === inventoryId) ?? null;

  async function handleDispense(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPrescription || !selectedInventory) return;
    setMsg('');

    try {
      await api.post('/pharmacy/dispense', {
        prescriptionId: selectedPrescription.id,
        drugId: selectedInventory.drug_id,
        inventoryId: selectedInventory.id,
        quantityDispensed: Number(quantityDispensed),
        overrideAllergyWarning,
        overrideInteractionWarning,
        witnessId: witnessId || undefined,
        notes: notes || undefined,
      });
      setMsg(t('Dispensed {{drug}} successfully.', { drug: selectedPrescription.drug_name }));
      setSelectedPrescriptionId('');
      setInventoryId('');
      setQuantityDispensed('1');
      setWitnessId('');
      setNotes('');
      setOverrideAllergyWarning(false);
      setOverrideInteractionWarning(false);
      loadData();
    } catch (err: any) {
      setMsg(err.message ?? t('Dispense failed.'));
    }
  }

  return (
    <DashboardShell navItems={nav} title={t('nav.dispense')} locale={locale}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('Pending prescriptions')}</div>
          <DataTable
            keyField="id"
            loading={loading}
            rows={pending}
            empty="No pending prescriptions to dispense."
            columns={[
              {
                key: 'patient_name',
                label: 'dash.patient',
                render: (row) => (
                  <button
                    onClick={() => {
                      setSelectedPrescriptionId(String(row.id));
                      setQuantityDispensed(String(row.quantity ?? 1));
                      setInventoryId('');
                    }}
                    style={{
                      background: selectedPrescriptionId === row.id ? '#185FA5' : '#f8fafc',
                      color: selectedPrescriptionId === row.id ? '#fff' : '#111827',
                      padding: '6px 10px',
                      fontSize: 12,
                    }}
                  >
                    {String(row.patient_name ?? '—')}
                  </button>
                ),
              },
              { key: 'patient_mrn', label: 'dash.mrn', width: '130px' },
              { key: 'drug_name', label: 'dash.drug', render: (row) => <strong>{String(row.drug_name ?? '—')}</strong> },
              { key: 'dosage', label: 'dash.dose', width: '100px' },
              { key: 'quantity', label: 'dash.quantity', width: '70px' },
              {
                key: 'has_allergies',
                label: 'Safety',
                width: '100px',
                render: (row) => row.has_allergies ? <Badge label="Allergy" preset="danger" /> : <Badge label="Clear" preset="success" />,
              },
            ]}
          />
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8', padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('Dispense selected prescription')}</div>
          {!selectedPrescription ? (
            <div style={{ fontSize: 13, color: '#888' }}>{t('Select a pending prescription from the table to begin dispensing.')}</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, marginBottom: 14 }}>
                <strong>{selectedPrescription.patient_name}</strong> ({selectedPrescription.patient_mrn})<br />
                {t('dash.drug')}: <strong>{selectedPrescription.drug_name}</strong><br />
                {t('dash.dose')}: {selectedPrescription.dosage} · {selectedPrescription.frequency}
              </div>

              <form onSubmit={handleDispense}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <select value={inventoryId} onChange={(e) => setInventoryId(e.target.value)} required>
                    <option value="">{t('Select inventory batch...')}</option>
                    {inventoryOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.generic_name} · {row.location} · {t('batch')} {row.batch_number ?? 'N/A'} · {t('stock')} {row.quantity_on_hand}
                      </option>
                    ))}
                  </select>

                  {selectedInventory && (
                    <div style={{ fontSize: 12, color: '#555', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                      {t('Available stock')}: <strong>{selectedInventory.quantity_on_hand}</strong><br />
                      {t('Batch')}: <strong>{selectedInventory.batch_number ?? 'N/A'}</strong><br />
                      {t('Expiry')}: <strong>{selectedInventory.expiry_date ? String(selectedInventory.expiry_date).slice(0, 10) : 'N/A'}</strong>
                    </div>
                  )}

                  <input type="number" min="0.1" step="0.1" value={quantityDispensed} onChange={(e) => setQuantityDispensed(e.target.value)} placeholder={t('Quantity dispensed')} required />
                  <input value={witnessId} onChange={(e) => setWitnessId(e.target.value)} placeholder={t('Witness ID for controlled drugs (optional)')} />
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t('Dispensing notes...')} />

                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#555' }}>
                    <input type="checkbox" checked={overrideAllergyWarning} onChange={(e) => setOverrideAllergyWarning(e.target.checked)} />
                    {t('Override non-severe allergy warning')}
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#555' }}>
                    <input type="checkbox" checked={overrideInteractionWarning} onChange={(e) => setOverrideInteractionWarning(e.target.checked)} />
                    {t('Override moderate interaction warning')}
                  </label>

                  <button type="submit" disabled={!selectedInventory}>{t('Confirm dispense')}</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginTop: 16,
          fontSize: 13,
          background: msg.toLowerCase().includes('failed') || msg.includes('ALERT') || msg.includes('WARNING') ? '#fef2f2' : '#f0fdf4',
          color: msg.toLowerCase().includes('failed') || msg.includes('ALERT') || msg.includes('WARNING') ? '#991b1b' : '#166534',
        }}>
          {msg}
        </div>
      )}
    </DashboardShell>
  );
}
