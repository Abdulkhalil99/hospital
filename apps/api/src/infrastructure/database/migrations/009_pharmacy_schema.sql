-- ============================================================
-- MIGRATION 009 — Pharmacy schema
-- Purpose: Drug catalog, inventory, dispensing, interactions
-- ============================================================

-- ── drugs ────────────────────────────────────────────────────
-- Master drug catalog. Shared across all pharmacy locations.
CREATE TABLE pharmacy.drugs (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name      VARCHAR(200) NOT NULL,
  brand_names       TEXT[],                    -- array of brand name strings
  drug_class        VARCHAR(100),
  atc_code          VARCHAR(20),               -- WHO ATC classification
  dosage_form       VARCHAR(50)  NOT NULL,     -- tablet, capsule, syrup, injection
  strength          VARCHAR(50)  NOT NULL,     -- 500mg, 5mg/ml
  unit              VARCHAR(20)  NOT NULL DEFAULT 'tablet',
  requires_prescription BOOLEAN  NOT NULL DEFAULT TRUE,
  is_controlled     BOOLEAN      NOT NULL DEFAULT FALSE,
  storage_conditions VARCHAR(200),             -- 'refrigerate 2-8°C'
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drugs_generic   ON pharmacy.drugs USING gin(to_tsvector('simple', generic_name));
CREATE INDEX idx_drugs_atc       ON pharmacy.drugs(atc_code) WHERE atc_code IS NOT NULL;
CREATE INDEX idx_drugs_class     ON pharmacy.drugs(drug_class) WHERE is_active = TRUE;

-- ── drug_interactions ────────────────────────────────────────
-- Checked when pharmacist reviews a prescription.
-- severity: major = do not dispense, moderate = warn, minor = info
CREATE TABLE pharmacy.drug_interactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a_id       UUID        NOT NULL REFERENCES pharmacy.drugs(id),
  drug_b_id       UUID        NOT NULL REFERENCES pharmacy.drugs(id),
  severity        VARCHAR(20) NOT NULL CHECK (severity IN ('minor','moderate','major')),
  description     TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (drug_a_id <> drug_b_id)
);

CREATE UNIQUE INDEX idx_drug_interactions_pair
  ON pharmacy.drug_interactions(LEAST(drug_a_id::text, drug_b_id::text),
                                GREATEST(drug_a_id::text, drug_b_id::text));

-- ── drug_inventory ───────────────────────────────────────────
-- Stock level per drug per location. Each pharmacy location
-- has its own inventory row.
CREATE TABLE pharmacy.drug_inventory (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id           UUID         NOT NULL REFERENCES pharmacy.drugs(id),
  location          VARCHAR(100) NOT NULL DEFAULT 'main_pharmacy',
  batch_number      VARCHAR(100),
  quantity_on_hand  NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(10,2) NOT NULL DEFAULT 0, -- reserved by pending prescriptions
  reorder_level     NUMERIC(10,2) NOT NULL DEFAULT 10,
  expiry_date       DATE,
  purchase_price    NUMERIC(10,2),
  selling_price     NUMERIC(10,2),
  currency          VARCHAR(3)   DEFAULT 'AFN',
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (drug_id, location, batch_number)
);

CREATE INDEX idx_inventory_drug     ON pharmacy.drug_inventory(drug_id);
CREATE INDEX idx_inventory_location ON pharmacy.drug_inventory(location);
CREATE INDEX idx_inventory_expiry   ON pharmacy.drug_inventory(expiry_date)
  WHERE expiry_date IS NOT NULL;
-- Alert query: SELECT * FROM pharmacy.drug_inventory
--   WHERE quantity_on_hand <= reorder_level

-- ── stock_movements ──────────────────────────────────────────
-- Every change to inventory quantity is recorded here.
-- source_of_truth for inventory: sum(movement) = current stock.
CREATE TABLE pharmacy.stock_movements (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id           UUID        NOT NULL REFERENCES pharmacy.drugs(id),
  inventory_id      UUID        NOT NULL REFERENCES pharmacy.drug_inventory(id),
  movement_type     VARCHAR(30) NOT NULL
                      CHECK (movement_type IN (
                        'purchase','dispensed','return','adjustment',
                        'expired','transfer_in','transfer_out','wastage'
                      )),
  quantity          NUMERIC(10,2) NOT NULL,  -- positive = stock in, negative = stock out
  quantity_before   NUMERIC(10,2) NOT NULL,
  quantity_after    NUMERIC(10,2) NOT NULL,
  reference_id      UUID,                    -- dispensing_record_id or purchase_order_id
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_stock_movements_drug      ON pharmacy.stock_movements(drug_id);
CREATE INDEX idx_stock_movements_date      ON pharmacy.stock_movements USING BRIN (created_at);
CREATE INDEX idx_stock_movements_reference ON pharmacy.stock_movements(reference_id)
  WHERE reference_id IS NOT NULL;

-- ── dispensing_records ───────────────────────────────────────
-- Final record of medication given to patient.
-- Links prescription (EMR) → physical drug → patient.
CREATE TABLE pharmacy.dispensing_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id   UUID        REFERENCES emr.prescriptions(id),
  patient_id        UUID        NOT NULL REFERENCES patients.patients(id),
  drug_id           UUID        NOT NULL REFERENCES pharmacy.drugs(id),
  inventory_id      UUID        NOT NULL REFERENCES pharmacy.drug_inventory(id),
  quantity_dispensed NUMERIC(8,2) NOT NULL,
  dispensed_by      UUID        NOT NULL REFERENCES auth.users(id),
  dispensed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Safety checks (recorded at dispense time)
  allergy_checked   BOOLEAN     NOT NULL DEFAULT FALSE,
  interaction_checked BOOLEAN   NOT NULL DEFAULT FALSE,
  interactions_found JSONB,                  -- list of interactions detected
  -- Controlled substance extra logging
  witness_id        UUID        REFERENCES auth.users(id),  -- required for controlled drugs
  wastage_quantity  NUMERIC(8,2) DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispensing_prescription ON pharmacy.dispensing_records(prescription_id);
CREATE INDEX idx_dispensing_patient      ON pharmacy.dispensing_records(patient_id);
CREATE INDEX idx_dispensing_drug         ON pharmacy.dispensing_records(drug_id);
CREATE INDEX idx_dispensing_date         ON pharmacy.dispensing_records USING BRIN (dispensed_at);

-- Trigger: reduce inventory after dispensing
CREATE OR REPLACE FUNCTION reduce_inventory_on_dispense()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pharmacy.drug_inventory
  SET quantity_on_hand = quantity_on_hand - NEW.quantity_dispensed,
      updated_at = NOW()
  WHERE id = NEW.inventory_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_dispense_reduce_stock
  AFTER INSERT ON pharmacy.dispensing_records
  FOR EACH ROW EXECUTE FUNCTION reduce_inventory_on_dispense();

-- ── suppliers ────────────────────────────────────────────────
CREATE TABLE pharmacy.suppliers (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  phone        VARCHAR(20),
  email        VARCHAR(255),
  address      TEXT,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── purchase_orders ──────────────────────────────────────────
CREATE TABLE pharmacy.purchase_orders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    UUID        NOT NULL REFERENCES pharmacy.suppliers(id),
  status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','received','partial','cancelled')),
  order_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  expected_date  DATE,
  received_date  DATE,
  total_amount   NUMERIC(12,2),
  currency       VARCHAR(3)  DEFAULT 'AFN',
  notes          TEXT,
  created_by     UUID        NOT NULL REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pharmacy.purchase_order_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL REFERENCES pharmacy.purchase_orders(id) ON DELETE CASCADE,
  drug_id          UUID        NOT NULL REFERENCES pharmacy.drugs(id),
  quantity_ordered NUMERIC(10,2) NOT NULL,
  quantity_received NUMERIC(10,2) DEFAULT 0,
  unit_price       NUMERIC(10,2) NOT NULL,
  expiry_date      DATE,
  batch_number     VARCHAR(100)
);