import { Router }              from 'express';
import { pharmacyController }  from './pharmacy.controller';
import { authenticate }        from '@/shared/middleware/authenticate';
import { authorize }           from '@/shared/middleware/authorize';
import { validate }            from '@/shared/middleware/validate';
import {
  dispenseSchema, addStockSchema, adjustStockSchema,
} from './pharmacy.validation';

export const pharmacyRouter = Router();
pharmacyRouter.use(authenticate);

// ── Drug catalog ───────────────────────────────────────────────
pharmacyRouter.get('/drugs',
  authorize('pharmacy:stock_read'),
  pharmacyController.searchDrugs,
);
pharmacyRouter.get('/drugs/:id',
  authorize('pharmacy:stock_read'),
  pharmacyController.getDrugById,
);

// ── Inventory ──────────────────────────────────────────────────
pharmacyRouter.get('/inventory',
  authorize('pharmacy:stock_read'),
  pharmacyController.getInventory,
);
pharmacyRouter.get('/inventory/drug/:drugId',
  authorize('pharmacy:stock_read'),
  pharmacyController.getInventoryByDrug,
);
pharmacyRouter.post('/inventory',
  authorize('pharmacy:stock_manage'),
  validate(addStockSchema),
  pharmacyController.addStock,
);
pharmacyRouter.post('/inventory/adjust',
  authorize('pharmacy:stock_manage'),
  validate(adjustStockSchema),
  pharmacyController.adjustStock,
);

// ── Alerts ─────────────────────────────────────────────────────
pharmacyRouter.get('/alerts/low-stock',
  authorize('pharmacy:stock_read'),
  pharmacyController.getLowStockAlerts,
);

// ── Prescriptions queue ────────────────────────────────────────
pharmacyRouter.get('/prescriptions/pending',
  authorize('pharmacy:dispense'),
  pharmacyController.getPendingPrescriptions,
);

// ── Dispense ───────────────────────────────────────────────────
pharmacyRouter.post('/dispense',
  authorize('pharmacy:dispense'),
  validate(dispenseSchema),
  pharmacyController.dispense,
);

// ── History ────────────────────────────────────────────────────
pharmacyRouter.get('/history/patient/:patientId',
  authorize('pharmacy:stock_read'),
  pharmacyController.getDispensingHistory,
);
