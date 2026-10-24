import { TelemedicineRepository }  from './telemedicine.repository';
import { CreateSessionInput }      from './telemedicine.types';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors/app-error';
import { signAccessToken }         from '@/shared/utils/jwt.util';
import { logger }                  from '@/infrastructure/logger/logger';
import { getParticipantRole, isTelemedicineManager, sessionWithoutTokens, TelemedicineActor } from './telemedicine.access';
import { sendMessageSchema } from './telemedicine.validation';

export class TelemedicineService {
  private repo = new TelemedicineRepository();

  // ── Create session ────────────────────────────────────────
  async createSession(data: CreateSessionInput, actor: TelemedicineActor) {
    await this.assertDoctorAccess(data.doctorId, actor);
    const session = await this.repo.createSession(data, actor.id);

    logger.info('Telemedicine session created', {
      sessionId: session.id,
      patientId: data.patientId,
      doctorId:  data.doctorId,
    });

    // Build join URLs
    const baseUrl = process.env.WEB_URL ?? 'http://localhost:3001';

    return {
      session,
      joinLinks: {
        doctor:  `${baseUrl}/tele/${session.id}?token=${session.doctor_token}`,
        patient: `${baseUrl}/tele/${session.id}?token=${session.patient_token}`,
      },
    };
  }

  // ── Join session via token (validates token, returns JWT for WS) ─
  async joinSession(token: string) {
    const session = await this.repo.findSessionByToken(token);

    if (!session) {
      throw new NotFoundError('Session — invalid or expired join token');
    }

    if (['ended', 'failed'].includes(session.status)) {
      throw new ForbiddenError('This session has ended.');
    }

    // Issue a short-lived JWT for WebSocket authentication
    // This is separate from the main app JWT so patients without accounts can join
    const wsToken = signAccessToken({
      sub:         session.id,    // sessionId as subject
      username:    session.role,
      roles:       [session.role],
      permissions: ['telemedicine'],
    });

    return {
      sessionId:   session.id,
      role:        session.role,
      patientName: session.patient_name,
      doctorName:  session.doctor_name,
      status:      session.status,
      wsToken,
    };
  }

  // ── Get session detail ────────────────────────────────────
  private async getSessionOrFail(id: string) {
    const session = await this.repo.findSessionById(id);
    if (!session) throw new NotFoundError('Session', id);
    return session;
  }

  async getSession(id: string, actor: TelemedicineActor) {
    const session = await this.getSessionOrFail(id);
    if (!getParticipantRole(session, actor.id) && !isTelemedicineManager(actor)) throw new ForbiddenError();
    return sessionWithoutTokens(session);
  }

  private async assertDoctorAccess(doctorId: string, actor: TelemedicineActor): Promise<void> {
    const doctorUserId = await this.repo.getDoctorUserId(doctorId);
    if (!doctorUserId) throw new NotFoundError('Doctor', doctorId);
    if (doctorUserId !== actor.id && !isTelemedicineManager(actor)) throw new ForbiddenError();
  }

  // ── Doctor's session list ─────────────────────────────────
  async getDoctorSessions(doctorId: string, actor: TelemedicineActor) {
    await this.assertDoctorAccess(doctorId, actor);
    return (await this.repo.getDoctorSessions(doctorId)).map(sessionWithoutTokens);
  }

  // ── Chat history ──────────────────────────────────────────
  async getChatHistory(sessionId: string, actor: TelemedicineActor) {
    const session = await this.getSession(sessionId, actor);
    const messages = await this.repo.getChatHistory(sessionId);
    return { session, messages };
  }

  // ── Send chat message via REST (fallback if WS unavailable) ─
  async sendChatMessage(
    sessionId:   string,
    actor:       TelemedicineActor,
    message:     string,
    messageType: string,
  ) {
    const session = await this.getSessionOrFail(sessionId);
    const senderRole = getParticipantRole(session, actor.id);
    if (!senderRole) throw new ForbiddenError();

    if (['ended', 'failed'].includes(session.status)) {
      throw new ForbiddenError('Cannot send messages to an ended session.');
    }

    if (!message.trim()) {
      throw new ValidationError([{ message: 'Message cannot be empty.' }]);
    }

    const payload = sendMessageSchema.parse({ message, messageType });
    return this.repo.saveMessage(sessionId, actor.id, senderRole, payload.message, payload.messageType);
  }

  // ── End session ───────────────────────────────────────────
  async endSession(sessionId: string, actor: TelemedicineActor) {
    const session = await this.getSession(sessionId, actor);

    if (session.status === 'ended') {
      return session;
    }

    const durationSeconds = session.started_at
      ? Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
      : 0;

    const updated = await this.repo.updateSessionStatus(sessionId, 'ended', {
      ended_at:         new Date(),
      duration_seconds: durationSeconds,
    });

    logger.info('Telemedicine session ended', {
      sessionId,
      duration: durationSeconds,
      by:       actor.id,
    });

    return updated ? sessionWithoutTokens(updated) : null;
  }
}
