import { PharmacyRepository }  from './pharmacy.repository';
import { DispenseInput, AddStockInput, AdjustStockInput } from './pharmacy.types';
import {
  NotFoundError, ConflictError,
  ForbiddenError, ValidationError,
} from '@/shared/errors/app-error';
import { logger } from '@/infrastructure/logger/logger';

export class PharmacyService {
  private repo = new PharmacyRepository();

  // ── Drugs catalog ─────────────────────────────────────────
  async searchDrugs(q = '', page = 1, limit = 20) {
    const safeLimit  = Math.min(100, limit);
    const offset     = (page - 1) * safeLimit;
    return this.repo.searchDrugs(q, safeLimit, offset);
  }

  async getDrugById(id: string) {
    const drug = await this.repo.getDrugById(id);
    if (!drug) throw new NotFoundError('Drug', id);
    return drug;
  }

  // ── Inventory ─────────────────────────────────────────────
  async getInventory(location?: string) {
    return this.repo.getInventory(location);
  }

  async getInventoryByDrug(drugId: string, location?: string) {
    return this.repo.getInventoryByDrug(drugId, location);
  }

  async addStock(data: AddStockInput, addedBy: string) {
    await this.getDrugById(data.drugId);

    const inventory = await this.repo.upsertInventory(data);

    await this.repo.recordStockMovement(
      data.drugId, inventory.id,
      'purchase', data.quantity,
      inventory.quantity_on_hand - data.quantity,
      inventory.quantity_on_hand,
      null, null, addedBy,
    );

    logger.info('Stock added', {
      drugId: data.drugId, quantity: data.quantity,
      location: data.location, addedBy,
    });

    return inventory;
  }

  async adjustStock(data: AdjustStockInput, adjustedBy: string) {
    const inventory = await this.repo.getInventoryById(data.inventoryId);
    if (!inventory) throw new NotFoundError('Inventory record', data.inventoryId);

    const newQty = inventory.quantity_on_hand + data.quantity;
    if (newQty < 0) {
      throw new ValidationError([{
        message: `Cannot remove ${Math.abs(data.quantity)} units. Only ${inventory.quantity_on_hand} on hand.`,
      }]);
    }

    const { before, after } = await this.repo.adjustInventoryQuantity(
      data.inventoryId, data.quantity,
    );

    await this.repo.recordStockMovement(
      inventory.drug_id, data.inventoryId,
      data.reason, data.quantity, before, after,
      null, data.notes ?? null, adjustedBy,
    );

    logger.info('Stock adjusted', {
      inventoryId: data.inventoryId,
      delta: data.quantity, reason: data.reason,
    });

    return { before, after };
  }

  // ── Pending prescriptions ─────────────────────────────────
  async getPendingPrescriptions() {
    return this.repo.getPendingPrescriptions();
  }

  // ── Core dispense logic ───────────────────────────────────
  async dispense(data: DispenseInput, dispensedBy: string) {
    // 1. Validate prescription exists and is pending
    const prescription = await this.repo.getPrescriptionById(data.prescriptionId);
    if (!prescription) throw new NotFoundError('Prescription', data.prescriptionId);
    if (prescription.status !== 'pending') {
      throw new ConflictError(
        `Prescription status is '${prescription.status}'. Only pending prescriptions can be dispensed.`,
      );
    }

    // 2. Validate inventory record
    const inventory = await this.repo.getInventoryById(data.inventoryId);
    if (!inventory) throw new NotFoundError('Inventory record', data.inventoryId);

    if (inventory.drug_id !== data.drugId) {
      throw new ValidationError([{
        message: 'Inventory record does not match the specified drug.',
      }]);
    }

    // 3. Check stock level
    if (inventory.quantity_on_hand < data.quantityDispensed) {
      throw new ConflictError(
        `Insufficient stock. Requested: ${data.quantityDispensed}, Available: ${inventory.quantity_on_hand}`,
      );
    }

    // 4. Check expiry
    if (inventory.expiry_date && new Date(inventory.expiry_date) < new Date()) {
      throw new ForbiddenError(
        `This batch expired on ${inventory.expiry_date}. Select a non-expired batch.`,
      );
    }

    // 5. Allergy check
    const allergyMatches = await this.repo.checkPatientAllergies(
      prescription.patient_id, data.drugId,
    );

    const severeAllergy = allergyMatches.find(
      a => a.severity === 'life_threatening' || a.severity === 'severe',
    );
    const mildAllergy = allergyMatches.find(
      a => a.severity === 'mild' || a.severity === 'moderate',
    );

    if (severeAllergy) {
      throw new ForbiddenError(
        `ALLERGY ALERT: Patient has a ${severeAllergy.severity} allergy to '${severeAllergy.allergen}'. Cannot dispense.`,
      );
    }

    if (mildAllergy && !data.overrideAllergyWarning) {
      throw new ConflictError(
        `ALLERGY WARNING: Patient has a ${mildAllergy.severity} allergy to '${mildAllergy.allergen}'. ` +
        `Set overrideAllergyWarning: true to proceed.`,
      );
    }

    // 6. Drug interaction check
    const interactions = await this.repo.checkDrugInteractions(
      data.drugId, prescription.patient_id,
    );

    const majorInteraction = interactions.find(i => i.severity === 'major');
    const moderateInteraction = interactions.find(i => i.severity === 'moderate');

    if (majorInteraction) {
      throw new ForbiddenError(
        `MAJOR INTERACTION: '${majorInteraction.drug_name}' — ${majorInteraction.description}. Cannot dispense.`,
      );
    }

    if (moderateInteraction && !data.overrideInteractionWarning) {
      throw new ConflictError(
        `INTERACTION WARNING: '${moderateInteraction.drug_name}' — ${moderateInteraction.description}. ` +
        `Set overrideInteractionWarning: true to proceed.`,
      );
    }

    // 7. Controlled substance witness check
    const drug = await this.repo.getDrugById(data.drugId);
    if (drug?.is_controlled && !data.witnessId) {
      throw new ValidationError([{
        message: 'Controlled substance requires a witnessId (supervisor or second pharmacist).',
      }]);
    }

    // 8. Deduct from inventory
    const { before, after } = await this.repo.adjustInventoryQuantity(
      data.inventoryId, -data.quantityDispensed,
    );

    // 9. Record stock movement
    await this.repo.recordStockMovement(
      data.drugId, data.inventoryId,
      'dispensed', -data.quantityDispensed,
      before, after,
      data.prescriptionId, data.notes ?? null, dispensedBy,
    );

    // 10. Create dispensing record
    const record = await this.repo.createDispensingRecord({
      prescriptionId:     data.prescriptionId,
      patientId:          prescription.patient_id,
      drugId:             data.drugId,
      inventoryId:        data.inventoryId,
      quantityDispensed:  data.quantityDispensed,
      dispensedBy,
      allergyChecked:     true,
      interactionChecked: true,
      interactionsFound:  interactions.length > 0 ? interactions : null,
      witnessId:          data.witnessId ?? null,
      notes:              data.notes     ?? null,
    });

    // 11. Update prescription status
    await this.repo.updatePrescriptionStatus(data.prescriptionId, 'dispensed');

    logger.info('Drug dispensed', {
      recordId:      record.id,
      prescriptionId: data.prescriptionId,
      drugId:        data.drugId,
      quantity:      data.quantityDispensed,
      dispensedBy,
    });

    return {
      record,
      stockAfter: after,
      warnings: {
        allergyWarning:     mildAllergy      ? `${mildAllergy.severity} allergy to ${mildAllergy.allergen}` : null,
        interactionWarning: moderateInteraction ? moderateInteraction.description : null,
      },
    };
  }

  // ── History + alerts ──────────────────────────────────────
  async getDispensingHistory(patientId: string, limit = 20) {
    return this.repo.getDispensingHistory(patientId, limit);
  }

  async getLowStockAlerts() {
    return this.repo.getLowStockAlerts();
  }
}
