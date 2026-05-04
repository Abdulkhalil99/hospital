import { TelemedicineRepository }  from './telemedicine.repository';
import { CreateSessionInput }      from './telemedicine.types';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors/app-error';
import { signAccessToken }         from '@/shared/utils/jwt.util';
import { logger }                  from '@/infrastructure/logger/logger';

export class TelemedicineService {
  private repo = new TelemedicineRepository();

  // ── Create session ────────────────────────────────────────
  async createSession(data: CreateSessionInput, createdBy: string) {
    const session = await this.repo.createSession(data, createdBy);

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

    if (session.status === 'ended') {
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
  async getSession(id: string) {
    const session = await this.repo.findSessionById(id);
    if (!session) throw new NotFoundError('Session', id);
    return session;
  }

  // ── Doctor's session list ─────────────────────────────────
  async getDoctorSessions(doctorId: string) {
    return this.repo.getDoctorSessions(doctorId);
  }

  // ── Chat history ──────────────────────────────────────────
  async getChatHistory(sessionId: string) {
    const session = await this.getSession(sessionId);
    const messages = await this.repo.getChatHistory(sessionId);
    return { session, messages };
  }

  // ── Send chat message via REST (fallback if WS unavailable) ─
  async sendChatMessage(
    sessionId:   string,
    senderId:    string,
    senderRole:  string,
    message:     string,
    messageType: string,
  ) {
    const session = await this.getSession(sessionId);

    if (session.status === 'ended') {
      throw new ForbiddenError('Cannot send messages to an ended session.');
    }

    if (!message.trim()) {
      throw new ValidationError([{ message: 'Message cannot be empty.' }]);
    }

    return this.repo.saveMessage(sessionId, senderId, senderRole, message, messageType);
  }

  // ── End session ───────────────────────────────────────────
  async endSession(sessionId: string, endedBy: string) {
    const session = await this.getSession(sessionId);

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
      by:       endedBy,
    });

    return updated;
  }
}
