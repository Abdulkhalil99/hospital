import { EmergencyRepository }  from './emergency.repository';
import {
  RegisterEmergencyVisitInput, TriageInput,
  AssignBedInput, UpdateVisitStatusInput,
  TraumaActivationInput,
} from './emergency.types';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/errors/app-error';
import { emitToQueue }   from '@/infrastructure/websocket/ws.server';
import { eventBus }      from '@/shared/events/event-bus';
import { EVENTS }        from '@/shared/events/event-types';
import { logger }        from '@/infrastructure/logger/logger';

// ESI 1 and 2 trigger immediate team notification
const CRITICAL_ESI_LEVELS = [1, 2];

export class EmergencyService {
  private repo = new EmergencyRepository();

  // ── Register arrival ──────────────────────────────────────
  async registerVisit(
    data:      RegisterEmergencyVisitInput,
    createdBy: string,
  ) {
    const visit = await this.repo.createVisit(data, createdBy);

    logger.info('Emergency visit registered', {
      visitId:     visit.id,
      arrivalMode: data.arrivalMode,
      hasPatient:  !!data.patientId,
    });

    // Broadcast to all ED screens immediately
    emitToQueue('emergency', 'emergency:visit_registered', {
      visitId:        visit.id,
      chiefComplaint: visit.chief_complaint,
      arrivalMode:    visit.arrival_mode,
      arrivedAt:      visit.arrived_at,
    });

    return visit;
  }

  // ── Triage ────────────────────────────────────────────────
  async performTriage(data: TriageInput, triagedBy: string) {
    const visit = await this.repo.findVisitById(data.visitId);
    if (!visit) throw new NotFoundError('Emergency visit', data.visitId);

    if (visit.status === 'discharged' || visit.status === 'deceased') {
      throw new ValidationError([{
        message: `Cannot triage a visit with status '${visit.status}'.`,
      }]);
    }

    // Override chief complaint if provided
    if (data.chiefComplaint) {
      await this.repo.updateVisitStatus(data.visitId, visit.status, {
        chief_complaint: data.chiefComplaint,
      });
    }

    const triage = await this.repo.createTriage(data, triagedBy);

    logger.info('Triage completed', {
      visitId:  data.visitId,
      esiLevel: data.esiLevel,
      by:       triagedBy,
    });

    // Broadcast updated board to all ED screens
    const board = await this.repo.getAllBeds();
    emitToQueue('emergency', 'emergency:board_updated', { board });

    // ESI 1 or 2 — broadcast immediate alert to all clinical staff
    if (CRITICAL_ESI_LEVELS.includes(data.esiLevel)) {
      const alertPayload = {
        visitId:        data.visitId,
        esiLevel:       data.esiLevel,
        chiefComplaint: data.chiefComplaint ?? visit.chief_complaint,
        patientName:    visit.patient_name,
        bedCode:        visit.bed_code,
        gcsScore:       data.gcsScore,
        o2Saturation:   data.o2Saturation,
        bpSystolic:     data.bpSystolic,
      };

      emitToQueue('emergency', 'emergency:critical_triage', alertPayload);

      logger.warn('CRITICAL TRIAGE — ESI level', {
        esiLevel:  data.esiLevel,
        visitId:   data.visitId,
        complaint: visit.chief_complaint,
      });
    }

    return triage;
  }

  async getTriageByVisit(visitId: string) {
    return this.repo.getTriageByVisit(visitId);
  }

  // ── Visit management ──────────────────────────────────────
  async getVisitById(id: string) {
    const visit = await this.repo.findVisitById(id);
    if (!visit) throw new NotFoundError('Emergency visit', id);
    return visit;
  }

  async getDashboard() {
    const [visits, stats] = await Promise.all([
      this.repo.getActiveDashboard(),
      this.repo.getTodayStats(),
    ]);
    return { visits, stats };
  }

  async updateVisitStatus(data: UpdateVisitStatusInput, updatedBy: string) {
    const visit = await this.getVisitById(data.visitId);

    const extra: Record<string, unknown> = {};
    if (data.disposition) extra.disposition = data.disposition;

    if (data.status === 'discharged') {
      extra.discharged_at = new Date();
      // Vacate bed on discharge
      if (visit.bed_id) {
        await this.repo.vacateBed(data.visitId);
      }
    }

    const updated = await this.repo.updateVisitStatus(data.visitId, data.status, extra);

    const board = await this.repo.getAllBeds();
    emitToQueue('emergency', 'emergency:board_updated', { board });

    logger.info('Emergency visit status updated', {
      visitId: data.visitId,
      status:  data.status,
      by:      updatedBy,
    });

    return updated;
  }

  // ── Beds ──────────────────────────────────────────────────
  async getAvailableBeds() {
    return this.repo.getAvailableBeds();
  }

  async getBedBoard() {
    return this.repo.getAllBeds();
  }

  async assignBed(data: AssignBedInput, assignedBy: string) {
    const visit = await this.getVisitById(data.visitId);

    // Check bed is not already occupied
    const beds = await this.repo.getAvailableBeds();
    const bed  = beds.find((b: { id: string; occupancy: string }) => b.id === data.bedId);
    if (!bed) throw new NotFoundError('Bed', data.bedId);
    if (bed.occupancy === 'occupied') {
      throw new ConflictError(`Bed ${bed.bed_code} is already occupied.`);
    }

    const assignment = await this.repo.assignBed(
      data.visitId, data.bedId, assignedBy, data.notes,
    );

    // Broadcast updated board
    const board = await this.repo.getAllBeds();
    emitToQueue('emergency', 'emergency:board_updated', { board });
    emitToQueue('emergency', 'emergency:bed_assigned', {
      visitId:    data.visitId,
      bedId:      data.bedId,
      bedCode:    bed.bed_code,
      patientName: visit.patient_name,
    });

    logger.info('Bed assigned', {
      visitId: data.visitId,
      bedCode: bed.bed_code,
      by:      assignedBy,
    });

    return assignment;
  }

  // ── Trauma activations ────────────────────────────────────
  async activateTrauma(data: TraumaActivationInput, activatedBy: string) {
    await this.getVisitById(data.visitId);

    const activation = await this.repo.createTraumaActivation(
      data.visitId,
      data.activationLevel,
      data.mechanism,
      activatedBy,
      data.notes,
    );

    const alertPayload = {
      activationId: activation.id,
      visitId:      data.visitId,
      level:        data.activationLevel,
      mechanism:    data.mechanism,
      activatedAt:  activation.activated_at,
    };

    // Broadcast to ALL connected clients — not just the ED room
    emitToQueue('emergency', 'emergency:trauma_activated', alertPayload);

    logger.warn('TRAUMA ACTIVATION', {
      visitId:   data.visitId,
      level:     data.activationLevel,
      mechanism: data.mechanism,
      by:        activatedBy,
    });

    return activation;
  }

  async getTraumaActivations(visitId?: string) {
    return this.repo.getTraumaActivations(visitId);
  }

  // ── Today stats ───────────────────────────────────────────
  async getTodayStats() {
    return this.repo.getTodayStats();
  }
}
