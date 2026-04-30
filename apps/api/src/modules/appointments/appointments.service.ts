import { AppointmentsRepository } from './appointments.repository';
import { DoctorsRepository }      from '@/modules/doctors/doctors.repository';
import { AvailabilityEngine }     from '@/modules/doctors/availability.engine';
import { CreateAppointmentInput } from './appointments.types';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/errors/app-error';
import { emitToQueue }   from '@/infrastructure/websocket/ws.server';
import { eventBus }      from '@/shared/events/event-bus';
import { EVENTS }        from '@/shared/events/event-types';
import { logger }        from '@/infrastructure/logger/logger';

export class AppointmentsService {
  private repo       = new AppointmentsRepository();
  private doctorRepo = new DoctorsRepository();
  private engine     = new AvailabilityEngine();

  async getTypes() {
    return this.repo.getTypes();
  }

  async list(filters: {
    doctorId?: string; patientId?: string;
    date?: string; status?: string;
    page?: number; limit?: number;
  }) {
    const limit  = Math.min(100, filters.limit  ?? 20);
    const offset = ((filters.page ?? 1) - 1) * limit;
    const { rows, total } = await this.repo.list({ ...filters, limit, offset });
    return {
      data:       rows,
      pagination: { page: filters.page ?? 1, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const appt = await this.repo.findById(id);
    if (!appt) throw new NotFoundError('Appointment', id);
    return appt;
  }

  async book(data: CreateAppointmentInput, createdBy: string) {
    // 1. Verify availability
    const avail = await this.engine.getForDate(data.doctorId, data.scheduledDate);

    if (!avail.isWorkDay) {
      throw new ValidationError([{ message: 'Doctor does not work on this day.' }]);
    }
    if (avail.isOnLeave) {
      throw new ValidationError([{ message: 'Doctor is on leave on this date.' }]);
    }
    if (avail.isHoliday) {
      throw new ValidationError([{ message: 'This is a public holiday.' }]);
    }

    const slot = avail.slots.find(s => s.startTime === data.scheduledStart);
    if (!slot) {
      throw new ValidationError([{ message: `Time slot ${data.scheduledStart} does not exist for this doctor.` }]);
    }
    if (!slot.available) {
      throw new ConflictError(`Time slot ${data.scheduledStart} is fully booked.`);
    }

    // 2. Double-check in DB (race condition guard)
    const taken = await this.repo.isSlotTaken(data.doctorId, data.scheduledDate, data.scheduledStart);
    if (taken) throw new ConflictError(`Time slot ${data.scheduledStart} was just booked. Please choose another.`);

    // 3. Create appointment
    const appt = await this.repo.create(
      { ...data, startTime: data.scheduledStart } as CreateAppointmentInput & { startTime: string },
      slot.endTime,
      createdBy,
    );

    logger.info('Appointment booked', {
      id: appt.id,
      doctorId: data.doctorId,
      patientId: data.patientId,
      date: data.scheduledDate,
      time: data.scheduledStart,
    });

    eventBus.emit(EVENTS.APPOINTMENT_CREATED, {
      appointmentId: appt.id,
      patientId:     data.patientId,
      doctorId:      data.doctorId,
      date:          data.scheduledDate,
      time:          data.scheduledStart,
    });

    return appt;
  }

  async cancel(id: string, reason: string, cancelledBy: string) {
    const appt = await this.getById(id);

    if (['completed', 'cancelled', 'no_show'].includes(appt.status)) {
      throw new ValidationError([{ message: `Cannot cancel an appointment with status '${appt.status}'.` }]);
    }

    const updated = await this.repo.updateStatus(id, 'cancelled', {
      cancelled_at:        new Date(),
      cancellation_reason: reason,
      cancelled_by:        cancelledBy,
    });

    eventBus.emit(EVENTS.APPOINTMENT_CANCELLED, { appointmentId: id });
    return updated;
  }

  async checkin(id: string, checkedInBy: string) {
    const appt = await this.getById(id);

    if (appt.status !== 'scheduled' && appt.status !== 'confirmed') {
      throw new ValidationError([{
        message: `Cannot check in appointment with status '${appt.status}'.`,
      }]);
    }

    // Update appointment status
    await this.repo.updateStatus(id, 'checked_in', {
      checked_in_at: new Date(),
      checked_in_by: checkedInBy,
    });

    // Create queue token
    const token = await this.repo.createQueueToken(
      id,
      appt.patient_id,
      appt.doctor_id,
      appt.is_walk_in ? 4 : 3,
    );

    // Broadcast to waiting room display and receptionist
    emitToQueue(appt.doctor_id, 'queue:token_added', {
      token: {
        id:           token.id,
        display:      token.token_display,
        tokenNumber:  token.token_number,
        patientName:  appt.patient_name,
        patientMrn:   appt.patient_mrn,
        status:       'waiting',
        priority:     token.priority,
      },
    });

    logger.info('Patient checked in', { appointmentId: id, token: token.token_display });

    eventBus.emit(EVENTS.APPOINTMENT_CHECKED_IN, {
      appointmentId: id,
      patientId:     appt.patient_id,
      doctorId:      appt.doctor_id,
      tokenDisplay:  token.token_display,
    });

    return { appointment: appt, token };
  }

  // ── Queue operations ──────────────────────────────────────
  async getLiveQueue(doctorId: string) {
    const tokens  = await this.repo.getLiveQueue(doctorId);
    const avgWait = await this.repo.getAvgConsultationMinutes(doctorId);

    return {
      tokens: tokens.map((t, index) => ({
        ...t,
        estimatedWaitMinutes: index * avgWait,
      })),
      avgConsultationMinutes: avgWait,
      totalWaiting: tokens.filter(t => t.status === 'waiting').length,
    };
  }

  async callNext(doctorId: string, calledBy: string) {
    const queue = await this.repo.getLiveQueue(doctorId);

    // Mark current 'called' token as in_room if exists
    const current = queue.find(t => t.status === 'called');
    if (current) {
      await this.repo.updateTokenStatus(current.id, 'in_room', {
        entered_room_at: new Date(),
      });
    }

    // Call the next waiting patient (highest priority, lowest token number)
    const next = queue
      .filter(t => t.status === 'waiting')
      .sort((a, b) => a.priority - b.priority || a.token_number - b.token_number)[0];

    if (!next) {
      emitToQueue(doctorId, 'queue:empty', { message: 'No more patients waiting.' });
      return null;
    }

    const updated = await this.repo.updateTokenStatus(next.id, 'called', {
      called_at: new Date(),
    });

    emitToQueue(doctorId, 'queue:patient_called', {
      tokenId:     next.id,
      display:     next.token_display,
      patientName: next.patient_name,
      patientMrn:  next.patient_mrn,
    });

    // Broadcast full updated queue
    const updatedQueue = await this.getLiveQueue(doctorId);
    emitToQueue(doctorId, 'queue:snapshot', updatedQueue);

    logger.info('Next patient called', { doctorId, token: next.token_display, calledBy });

    eventBus.emit(EVENTS.QUEUE_PATIENT_CALLED, {
      tokenId:   next.id,
      patientId: next.patient_id,
      doctorId,
    });

    return updated;
  }

  async completeToken(tokenId: string) {
    const token = await this.repo.getTokenById(tokenId);
    if (!token) throw new NotFoundError('Queue token', tokenId);

    const waitMins = token.called_at
      ? Math.round((Date.now() - new Date(token.called_at).getTime()) / 60000)
      : null;

    await this.repo.updateTokenStatus(tokenId, 'completed', {
      completed_at: new Date(),
      wait_minutes: waitMins,
    });

    await this.repo.updateStatus(token.appointment_id, 'completed', {
      completed_at: new Date(),
    });

    const updatedQueue = await this.getLiveQueue(token.doctor_id);
    emitToQueue(token.doctor_id, 'queue:snapshot', updatedQueue);
    emitToQueue(token.doctor_id, 'queue:wait_updated', {
      avgWait:    updatedQueue.avgConsultationMinutes,
      totalWaiting: updatedQueue.totalWaiting,
    });

    return token;
  }

  async skipToken(tokenId: string) {
    const token = await this.repo.getTokenById(tokenId);
    if (!token) throw new NotFoundError('Queue token', tokenId);

    // Re-queue at end with lowest priority
    await this.repo.updateTokenStatus(tokenId, 'waiting', { priority: 5 });

    emitToQueue(token.doctor_id, 'queue:token_updated', {
      tokenId, status: 'waiting', priority: 5,
    });

    const updatedQueue = await this.getLiveQueue(token.doctor_id);
    emitToQueue(token.doctor_id, 'queue:snapshot', updatedQueue);

    return token;
  }
}
