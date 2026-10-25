import { Server as SocketServer, Socket } from 'socket.io';
import { z } from 'zod';
import { TelemedicineRepository } from './telemedicine.repository';
import { resolveSocketParticipant, ParticipantRole } from './telemedicine.access';
import { sendMessageSchema } from './telemedicine.validation';
import { logger } from '@/infrastructure/logger/logger';

const repo = new TelemedicineRepository();
const sessionPayload = z.object({ sessionId: z.string().uuid() });
const description = z.object({
  type: z.enum(['offer', 'answer', 'pranswer', 'rollback']).optional(),
  sdp: z.string().max(100_000).nullable().optional(),
});
const candidate = z.object({
  candidate: z.string().max(10_000).optional(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

function roomName(sessionId: string): string { return `tele:${sessionId}`; }

export function registerSignalingHandlers(io: SocketServer): void {
  io.on('connection', (socket: Socket) => {
    let joined: { id: string; role: ParticipantRole } | undefined;

    // Every event is validated and catches repository/socket failures.
    function on<T>(event: string, schema: z.ZodType<T>, handle: (data: T) => Promise<void>): void {
      socket.on(event, async (data: unknown) => {
        try {
          await handle(schema.parse(data));
        } catch (error) {
          logger.warn('Tele: request rejected', { event, socketId: socket.id, error: error instanceof Error ? error.message : 'Unknown error' });
          socket.emit('tele:error', { message: 'Unable to process telemedicine request' });
        }
      });
    }

    async function authorizedSession(sessionId: string, requireJoined = true) {
      if (requireJoined && (joined?.id !== sessionId || !socket.rooms.has(roomName(sessionId)))) {
        throw new Error('Join this session before sending events');
      }
      const session = await repo.findSessionById(sessionId);
      if (!session || ['ended', 'failed'].includes(session.status)) throw new Error('Session is unavailable');
      const participant = resolveSocketParticipant(session, socket.data.user);
      if (!participant) throw new Error('Not a participant in this session');
      return { session, ...participant };
    }

    on('tele:join', sessionPayload, async ({ sessionId }) => {
      const { session, role } = await authorizedSession(sessionId, false);
      if (joined && joined.id !== sessionId) await socket.leave(roomName(joined.id));
      const room = roomName(sessionId);
      await socket.join(room);
      joined = { id: sessionId, role };
      socket.to(room).emit('tele:participant_joined', { role, sessionId, timestamp: new Date().toISOString() });

      let status = session.status;
      if (role === 'doctor' && status === 'waiting') {
        await repo.updateSessionStatus(sessionId, 'active', { started_at: new Date() });
        status = 'active';
        io.to(room).emit('tele:session_started', { sessionId });
      }
      socket.emit('tele:session_state', { sessionId, status, patientName: session.patient_name, doctorName: session.doctor_name });
      logger.info('Tele: participant joined', { sessionId, role, socketId: socket.id });
    });

    for (const event of ['offer', 'answer'] as const) {
      on(`tele:${event}`, sessionPayload.extend({ sdp: description }), async ({ sessionId, sdp }) => {
        const { role } = await authorizedSession(sessionId);
        await repo.logSignalingEvent(sessionId, event, role);
        socket.to(roomName(sessionId)).emit(`tele:${event}`, { sdp, fromRole: role });
      });
    }

    on('tele:ice_candidate', sessionPayload.extend({ candidate }), async ({ sessionId, candidate: iceCandidate }) => {
      const { role } = await authorizedSession(sessionId);
      await repo.logSignalingEvent(sessionId, 'ice_candidate', role);
      socket.to(roomName(sessionId)).emit('tele:ice_candidate', { candidate: iceCandidate, fromRole: role });
    });

    on('tele:chat', sessionPayload.merge(sendMessageSchema), async ({ sessionId, message, messageType }) => {
      const { role, senderId } = await authorizedSession(sessionId);
      if (!message.trim()) throw new Error('Message cannot be empty');
      const saved = await repo.saveMessage(sessionId, senderId, role, message, messageType ?? 'text');
      io.to(roomName(sessionId)).emit('tele:chat', {
        id: saved.id, message: saved.message, messageType: saved.message_type,
        fromRole: role, senderId, timestamp: saved.created_at,
      });
    });

    on('tele:consent', sessionPayload.extend({ consent: z.boolean() }), async ({ sessionId, consent }) => {
      const { role } = await authorizedSession(sessionId);
      if (consent) await repo.setConsent(sessionId, role);
      socket.to(roomName(sessionId)).emit('tele:consent', { role, consent });
    });

    on('tele:end_call', sessionPayload, async ({ sessionId }) => {
      const { session, role } = await authorizedSession(sessionId);
      const durationSeconds = session.started_at ? Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)) : 0;
      await repo.updateSessionStatus(sessionId, 'ended', { ended_at: new Date(), duration_seconds: durationSeconds });
      await repo.logSignalingEvent(sessionId, 'ended', role);
      const room = roomName(sessionId);
      io.to(room).emit('tele:call_ended', { sessionId, endedBy: role, timestamp: new Date().toISOString() });
      const sockets = await io.in(room).fetchSockets();
      await Promise.all(sockets.map(participant => participant.leave(room)));
      joined = undefined;
    });

    socket.on('disconnect', () => {
      if (joined) socket.to(roomName(joined.id)).emit('tele:participant_left', { role: joined.role, sessionId: joined.id });
    });
  });
  logger.info('WebRTC signaling handlers registered');
}
