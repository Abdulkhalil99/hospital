import { LaboratoryRepository } from './laboratory.repository';
import {
  CollectSampleInput, ReceiveSampleInput,
  RejectSampleInput, EnterResultInput,
} from './laboratory.types';
import { NotFoundError, ValidationError, ForbiddenError } from '@/shared/errors/app-error';
import { eventBus }  from '@/shared/events/event-bus';
import { EVENTS }    from '@/shared/events/event-types';
import { logger }    from '@/infrastructure/logger/logger';

export class LaboratoryService {
  private repo = new LaboratoryRepository();

  // ── Test catalog ──────────────────────────────────────────
  async getTestCatalog() {
    return this.repo.getTestCatalog();
  }

  async getTestWithRanges(testId: string) {
    return this.repo.getTestWithRanges(testId);
  }

  // ── Worklist ──────────────────────────────────────────────
  async getWorklist(filters: {
    status?: string; urgency?: string; date?: string;
  }) {
    return this.repo.getWorklist(filters);
  }

  async getOrderById(id: string) {
    const order = await this.repo.getOrderById(id);
    if (!order) throw new NotFoundError('Lab order', id);
    return order;
  }

  // ── Sample collection ─────────────────────────────────────
  async collectSample(data: CollectSampleInput, collectedBy: string) {
    const order = await this.getOrderById(data.orderId);

    if (!['ordered', 'sample_collected'].includes(order.status)) {
      throw new ValidationError([{
        message: `Cannot collect sample for order with status '${order.status}'.`,
      }]);
    }

    const barcode = data.barcodeOverride ?? await this.repo.generateBarcode();

    // Find the lab test for reference ranges
    const catalog = await this.repo.getTestCatalog();
    const labTest  = catalog.find((t: { code: string }) => t.code === order.test_code) ?? null;

    const sample = await this.repo.createSample(
      data.orderId,
      order.patient_id,
      labTest?.id ?? null,
      barcode,
      data.sampleType,
      collectedBy,
      data.notes ?? null,
    );

    await this.repo.updateOrderStatus(data.orderId, 'sample_collected');

    logger.info('Sample collected', {
      orderId:  data.orderId,
      barcode,
      sampleId: sample.id,
    });

    return sample;
  }

  // ── Receive at lab ────────────────────────────────────────
  async receiveSample(data: ReceiveSampleInput, receivedBy: string) {
    const sample = await this.repo.findSampleByBarcode(data.barcode);
    if (!sample) throw new NotFoundError('Sample', data.barcode);

    if (sample.status !== 'collected') {
      throw new ValidationError([{
        message: `Sample status is '${sample.status}'. Only collected samples can be received.`,
      }]);
    }

    const updated = await this.repo.updateSampleStatus(sample.id, 'received', {
      received_at: new Date(),
      received_by: receivedBy,
    });

    await this.repo.updateOrderStatus(sample.order_id, 'sample_collected');

    logger.info('Sample received at lab', { barcode: data.barcode, sampleId: sample.id });
    return updated;
  }

  // ── Reject sample ─────────────────────────────────────────
  async rejectSample(data: RejectSampleInput, rejectedBy: string) {
    const sample = await this.repo.findSampleByBarcode(data.barcode);
    if (!sample) throw new NotFoundError('Sample', data.barcode);

    await this.repo.updateSampleStatus(sample.id, 'rejected', {
      rejection_reason: data.rejectionReason,
    });

    // Reset order to ordered so a new sample can be collected
    await this.repo.updateOrderStatus(sample.order_id, 'ordered');

    logger.warn('Sample rejected', {
      barcode: data.barcode,
      reason:  data.rejectionReason,
      by:      rejectedBy,
    });

    return { message: `Sample ${data.barcode} rejected. Order reset for re-collection.` };
  }

  // ── Enter results ─────────────────────────────────────────
  async enterResults(data: EnterResultInput, enteredBy: string) {
    const sample = await this.repo.findSampleById(data.sampleId);
    if (!sample) throw new NotFoundError('Sample', data.sampleId);

    if (!['received', 'processing'].includes(sample.status)) {
      throw new ValidationError([{
        message: `Sample status is '${sample.status}'. Results can only be entered for received samples.`,
      }]);
    }

    // Mark sample as processing
    await this.repo.updateSampleStatus(sample.id, 'processing');

    // Get patient age and gender for reference range lookup
    const order = await this.repo.getOrderById(sample.order_id);
    const ageYears = order?.date_of_birth
      ? Math.floor((Date.now() - new Date(order.date_of_birth).getTime()) / (365.25 * 86400000))
      : 30;
    const gender = order?.gender ?? 'all';

    const results = [];

    for (const comp of data.components) {
      // Try to parse numeric value
      const numericValue = parseFloat(comp.resultValue.replace(/[<>]/g, ''));
      const resultNumeric = isNaN(numericValue) ? null : numericValue;

      // Get reference range for this component
      let normalMin: number | null = null;
      let normalMax: number | null = null;
      let criticalLow: number | null  = null;
      let criticalHigh: number | null = null;
      let flag: string | null = null;
      let isCritical = false;

      if (sample.lab_test_id && resultNumeric !== null) {
        const range = await this.repo.getReferenceRange(
          sample.lab_test_id, comp.componentName, gender, ageYears,
        );

        if (range) {
          normalMin    = range.normal_min;
          normalMax    = range.normal_max;
          criticalLow  = range.critical_low;
          criticalHigh = range.critical_high;

          // Compute flag
          if (criticalLow  !== null && resultNumeric < criticalLow)  { flag = 'LL'; isCritical = true; }
          else if (criticalHigh !== null && resultNumeric > criticalHigh) { flag = 'HH'; isCritical = true; }
          else if (normalMin !== null && resultNumeric < normalMin)   { flag = 'L'; }
          else if (normalMax !== null && resultNumeric > normalMax)   { flag = 'H'; }
          else                                                          { flag = 'N'; }
        }
      }

      const result = await this.repo.insertResult({
        sampleId:      data.sampleId,
        orderId:       sample.order_id,
        patientId:     sample.patient_id,
        componentName: comp.componentName,
        resultValue:   comp.resultValue,
        resultNumeric,
        unit:          comp.unit ?? null,
        normalMin,
        normalMax,
        flag,
        isCritical,
        enteredBy,
      });

      results.push(result);

      if (isCritical) {
        logger.warn('Critical lab value detected', {
          component: comp.componentName,
          value:     comp.resultValue,
          patientId: sample.patient_id,
          orderId:   sample.order_id,
        });

        eventBus.emit(EVENTS.LAB_CRITICAL_VALUE, {
          resultId:  result.id,
          orderId:   sample.order_id,
          patientId: sample.patient_id,
          component: comp.componentName,
          value:     comp.resultValue,
        });
      }
    }

    // Mark sample as resulted
    await this.repo.updateSampleStatus(sample.id, 'resulted');
    await this.repo.updateOrderStatus(sample.order_id, 'resulted');

    logger.info('Lab results entered', {
      sampleId:       data.sampleId,
      resultCount:    results.length,
      criticalCount:  results.filter(r => r.is_critical).length,
    });

    return results;
  }

  // ── Validate results ──────────────────────────────────────
  async validateResults(resultIds: string[], validatedBy: string) {
    if (resultIds.length === 0) {
      throw new ValidationError([{ message: 'No result IDs provided.' }]);
    }
    await this.repo.validateResults(resultIds, validatedBy);

    // Fire event — notification module sends result-ready notification
    eventBus.emit(EVENTS.LAB_RESULT_READY, { resultIds });

    logger.info('Lab results validated', { count: resultIds.length, by: validatedBy });
    return { validated: resultIds.length };
  }

  // ── Release to patient portal ─────────────────────────────
  async releaseResults(resultIds: string[], releasedBy: string) {
    await this.repo.releaseResults(resultIds, releasedBy);
    logger.info('Lab results released to patient portal', { count: resultIds.length });
    return { released: resultIds.length };
  }

  // ── Fetch results ─────────────────────────────────────────
  async getResultsBySample(sampleId: string) {
    const sample = await this.repo.findSampleById(sampleId);
    if (!sample) throw new NotFoundError('Sample', sampleId);
    const results = await this.repo.getResultsBySample(sampleId);
    return { sample, results };
  }

  async getResultsByOrder(orderId: string) {
    const order = await this.getOrderById(orderId);
    const results = await this.repo.getResultsByOrder(orderId);
    return { order, results };
  }

  async getResultsByPatient(patientId: string, released = false) {
    return this.repo.getResultsByPatient(patientId, released);
  }

  // ── Critical alerts ───────────────────────────────────────
  async getPendingCriticalAlerts() {
    return this.repo.getPendingCriticalAlerts();
  }

  async acknowledgeCriticalAlert(alertId: string, userId: string, note?: string) {
    await this.repo.acknowledgeCriticalAlert(alertId, userId, note);
    logger.info('Critical alert acknowledged', { alertId, by: userId });
  }
}
