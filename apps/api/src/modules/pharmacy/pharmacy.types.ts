export interface DispenseInput {
  prescriptionId:       string;
  drugId:               string;
  inventoryId:          string;
  quantityDispensed:    number;
  overrideAllergyWarning?:      boolean;
  overrideInteractionWarning?:  boolean;
  witnessId?:           string;   // required for controlled substances
  notes?:               string;
}

export interface AddStockInput {
  drugId:         string;
  location:       string;
  batchNumber?:   string;
  quantity:       number;
  expiryDate?:    string;
  purchasePrice?: number;
  sellingPrice?:  number;
  supplierId?:    string;
}

export interface AdjustStockInput {
  inventoryId:   string;
  quantity:      number;   // positive = add, negative = remove
  reason:        'adjustment' | 'expired' | 'wastage' | 'return' | 'transfer_in' | 'transfer_out';
  notes?:        string;
}

export interface DrugRow {
  id:                   string;
  generic_name:         string;
  brand_names:          string[];
  drug_class:           string | null;
  atc_code:             string | null;
  dosage_form:          string;
  strength:             string;
  unit:                 string;
  requires_prescription: boolean;
  is_controlled:        boolean;
  is_active:            boolean;
}

export interface InventoryRow {
  id:               string;
  drug_id:          string;
  location:         string;
  batch_number:     string | null;
  quantity_on_hand: number;
  reorder_level:    number;
  expiry_date:      Date | null;
  selling_price:    number | null;
  generic_name?:    string;
  dosage_form?:     string;
  strength?:        string;
}

export interface DispensingRow {
  id:                   string;
  prescription_id:      string | null;
  patient_id:           string;
  drug_id:              string;
  quantity_dispensed:   number;
  dispensed_by:         string;
  dispensed_at:         Date;
  allergy_checked:      boolean;
  interaction_checked:  boolean;
  interactions_found:   unknown;
  notes:                string | null;
}
