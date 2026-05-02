import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import { AddStockInput, DrugRow, InventoryRow, DispensingRow } from './pharmacy.types';

export class PharmacyRepository {
  private db: Pool = getDb();

  // ── Drugs ─────────────────────────────────────────────────
  async searchDrugs(q: string, limit: number, offset: number): Promise<DrugRow[]> {
    const { rows } = await this.db.query<DrugRow>(
      `SELECT * FROM pharmacy.drugs
       WHERE is_active = TRUE
         AND (generic_name ILIKE $1
           OR $1 = ''
           OR EXISTS (SELECT 1 FROM unnest(brand_names) bn WHERE bn ILIKE $1))
       ORDER BY generic_name
       LIMIT $2 OFFSET $3`,
      [`%${q}%`, limit, offset],
    );
    return rows;
  }

  async getDrugById(id: string): Promise<DrugRow | null> {
    const { rows } = await this.db.query<DrugRow>(
      `SELECT * FROM pharmacy.drugs WHERE id = $1 AND is_active = TRUE`,
      [id],
    );
    return rows[0] ?? null;
  }

  // ── Inventory ─────────────────────────────────────────────
  async getInventory(location?: string): Promise<InventoryRow[]> {
    const params: unknown[] = [];
    let where = 'TRUE';
    if (location) { params.push(location); where = `di.location = $1`; }

    const { rows } = await this.db.query<InventoryRow>(
      `SELECT di.*,
              d.generic_name, d.dosage_form, d.strength,
              d.is_controlled, d.requires_prescription
       FROM pharmacy.drug_inventory di
       JOIN pharmacy.drugs d ON d.id = di.drug_id
       WHERE ${where}
       ORDER BY d.generic_name`,
      params,
    );
    return rows;
  }

  async getInventoryByDrug(drugId: string, location?: string): Promise<InventoryRow[]> {
    const params: unknown[] = [drugId];
    let where = `di.drug_id = $1`;
    if (location) { params.push(location); where += ` AND di.location = $2`; }

    const { rows } = await this.db.query<InventoryRow>(
      `SELECT di.*, d.generic_name, d.dosage_form, d.strength
       FROM pharmacy.drug_inventory di
       JOIN pharmacy.drugs d ON d.id = di.drug_id
       WHERE ${where}
       ORDER BY di.expiry_date ASC NULLS LAST`,
      params,
    );
    return rows;
  }

  async getInventoryById(id: string): Promise<InventoryRow | null> {
    const { rows } = await this.db.query<InventoryRow>(
      `SELECT di.*, d.generic_name, d.dosage_form, d.strength, d.is_controlled
       FROM pharmacy.drug_inventory di
       JOIN pharmacy.drugs d ON d.id = di.drug_id
       WHERE di.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async upsertInventory(data: AddStockInput): Promise<InventoryRow> {
    const { rows } = await this.db.query<InventoryRow>(
      `INSERT INTO pharmacy.drug_inventory
         (drug_id, location, batch_number, quantity_on_hand,
          expiry_date, purchase_price, selling_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (drug_id, location, batch_number)
         WHERE batch_number IS NOT NULL
       DO UPDATE SET
         quantity_on_hand = pharmacy.drug_inventory.quantity_on_hand + EXCLUDED.quantity_on_hand,
         expiry_date      = EXCLUDED.expiry_date,
         purchase_price   = EXCLUDED.purchase_price,
         selling_price    = EXCLUDED.selling_price,
         updated_at       = NOW()
       RETURNING *`,
      [
        data.drugId, data.location,
        data.batchNumber ?? null,
        data.quantity,
        data.expiryDate  ?? null,
        data.purchasePrice ?? null,
        data.sellingPrice  ?? null,
      ],
    );
    return rows[0];
  }

  async adjustInventoryQuantity(
    inventoryId: string,
    delta:       number,
  ): Promise<{ before: number; after: number }> {
    const { rows } = await this.db.query<{
      before: number; after: number;
    }>(
      `UPDATE pharmacy.drug_inventory
       SET quantity_on_hand = quantity_on_hand + $2,
           updated_at       = NOW()
       WHERE id = $1
       RETURNING
         (quantity_on_hand - $2) AS before,
         quantity_on_hand        AS after`,
      [inventoryId, delta],
    );
    return rows[0];
  }

  async recordStockMovement(
    drugId:        string,
    inventoryId:   string,
    type:          string,
    quantity:      number,
    before:        number,
    after:         number,
    referenceId:   string | null,
    notes:         string | null,
    createdBy:     string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO pharmacy.stock_movements
         (drug_id, inventory_id, movement_type, quantity,
          quantity_before, quantity_after, reference_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [drugId, inventoryId, type, quantity, before, after, referenceId, notes, createdBy],
    );
  }

  // ── Dispensing ────────────────────────────────────────────
  async createDispensingRecord(data: {
    prescriptionId:    string | null;
    patientId:         string;
    drugId:            string;
    inventoryId:       string;
    quantityDispensed: number;
    dispensedBy:       string;
    allergyChecked:    boolean;
    interactionChecked: boolean;
    interactionsFound: unknown;
    witnessId:         string | null;
    notes:             string | null;
  }): Promise<DispensingRow> {
    const { rows } = await this.db.query<DispensingRow>(
      `INSERT INTO pharmacy.dispensing_records
         (prescription_id, patient_id, drug_id, inventory_id,
          quantity_dispensed, dispensed_by, allergy_checked,
          interaction_checked, interactions_found, witness_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.prescriptionId,
        data.patientId,
        data.drugId,
        data.inventoryId,
        data.quantityDispensed,
        data.dispensedBy,
        data.allergyChecked,
        data.interactionChecked,
        data.interactionsFound ? JSON.stringify(data.interactionsFound) : null,
        data.witnessId ?? null,
        data.notes     ?? null,
      ],
    );
    return rows[0];
  }

  async getDispensingHistory(patientId: string, limit = 20) {
    const { rows } = await this.db.query(
      `SELECT dr.*,
              d.generic_name, d.dosage_form, d.strength,
              u.full_name AS dispensed_by_name
       FROM pharmacy.dispensing_records dr
       JOIN pharmacy.drugs d ON d.id = dr.drug_id
       JOIN auth.users     u ON u.id = dr.dispensed_by
       WHERE dr.patient_id = $1
       ORDER BY dr.dispensed_at DESC
       LIMIT $2`,
      [patientId, limit],
    );
    return rows;
  }

  async getPendingPrescriptions() {
    const { rows } = await this.db.query(
      `SELECT pr.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn AS patient_mrn,
              p.has_allergies,
              u.full_name AS prescribed_by_name,
              e.started_at AS encounter_date
       FROM emr.prescriptions pr
       JOIN patients.patients p ON p.id = pr.patient_id
       JOIN auth.users         u ON u.id = pr.prescribed_by
       JOIN emr.encounters     e ON e.id = pr.encounter_id
       WHERE pr.status = 'pending'
       ORDER BY pr.created_at ASC`,
    );
    return rows;
  }

  // ── Safety checks ─────────────────────────────────────────
  async checkPatientAllergies(
    patientId: string, drugId: string,
  ): Promise<{ severity: string; allergen: string }[]> {
    const drug = await this.getDrugById(drugId);
    if (!drug) return [];

    const { rows } = await this.db.query<{ severity: string; allergen: string }>(
      `SELECT a.severity, a.allergen
       FROM patients.allergies a
       WHERE a.patient_id = $1
         AND a.is_active  = TRUE
         AND (
           a.allergen ILIKE $2
           OR a.allergen ILIKE $3
           OR ($4 IS NOT NULL AND a.allergen ILIKE $4)
         )`,
      [
        patientId,
        `%${drug.generic_name}%`,
        `%${drug.drug_class ?? '___NOMATCH___'}%`,
        drug.drug_class ? `%${drug.drug_class}%` : null,
      ],
    );
    return rows;
  }

  async checkDrugInteractions(
    drugId:    string,
    patientId: string,
  ): Promise<{ drug_name: string; severity: string; description: string }[]> {
    const { rows } = await this.db.query<{
      drug_name: string; severity: string; description: string;
    }>(
      `SELECT
         CASE
           WHEN di.drug_a_id = $1 THEN d2.generic_name
           ELSE d1.generic_name
         END AS drug_name,
         di.severity,
         di.description
       FROM pharmacy.drug_interactions di
       JOIN pharmacy.drugs d1 ON d1.id = di.drug_a_id
       JOIN pharmacy.drugs d2 ON d2.id = di.drug_b_id
       WHERE (di.drug_a_id = $1 OR di.drug_b_id = $1)
         AND (
           (di.drug_a_id = $1 AND di.drug_b_id IN (
             SELECT dr2.drug_id FROM pharmacy.dispensing_records dr2
             WHERE dr2.patient_id = $2
               AND dr2.dispensed_at > NOW() - INTERVAL '90 days'
           ))
           OR
           (di.drug_b_id = $1 AND di.drug_a_id IN (
             SELECT dr2.drug_id FROM pharmacy.dispensing_records dr2
             WHERE dr2.patient_id = $2
               AND dr2.dispensed_at > NOW() - INTERVAL '90 days'
           ))
         )`,
      [drugId, patientId],
    );
    return rows;
  }

  async getPrescriptionById(id: string) {
    const { rows } = await this.db.query(
      `SELECT pr.*, p.id AS patient_id
       FROM emr.prescriptions pr
       JOIN patients.patients p ON p.id = pr.patient_id
       WHERE pr.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updatePrescriptionStatus(id: string, status: string): Promise<void> {
    await this.db.query(
      `UPDATE emr.prescriptions
       SET status = $2, dispensed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, status],
    );
  }

  async getLowStockAlerts() {
    const { rows } = await this.db.query(
      `SELECT * FROM public.v_drug_stock_alerts ORDER BY alert_type, stock_gap ASC`,
    );
    return rows;
  }
}
