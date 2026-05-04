import { Server as SocketServer, Socket } from 'socket.io';
import { TelemedicineRepository }         from './telemedicine.repository';
import { SignalingMessage }               from './telemedicine.types';
import { logger }                         from '@/infrastructure/logger/logger';

const repo = new TelemedicineRepository();

// Room naming: tele:{sessionId}
function roomName(sessionId: string): string {
  return `tele:${sessionId}`;
}

export function registerSignalingHandlers(io: SocketServer): void {

  io.on('connection', (socket: Socket & { user?: { id: string; roles: string[] } }) => {

    // ── Join a telemedicine session room ──────────────────
    socket.on('tele:join', async (data: { sessionId: string; role: string }) => {
      const { sessionId, role } = data;

      const session = await repo.findSessionById(sessionId);
      if (!session) {
        socket.emit('tele:error', { message: 'Session not found' });
        return;
      }

      if (session.status === 'ended') {
        socket.emit('tele:error', { message: 'Session has ended' });
        return;
      }

      const room = roomName(sessionId);
      socket.join(room);

      // Attach session info to socket for later use
      (socket as Socket & { teleSession?: { id: string; role: string } }).teleSession = {
        id: sessionId, role,
      };

      logger.info('Tele: participant joined', { sessionId, role, socketId: socket.id });

      // Tell the other participant this person arrived
      socket.to(room).emit('tele:participant_joined', {
        role,
        sessionId,
        timestamp: new Date().toISOString(),
      });

      // If doctor joins and session is waiting, mark as active
      if (role === 'doctor' && session.status === 'waiting') {
        await repo.updateSessionStatus(sessionId, 'active', {
          started_at: new Date(),
        });
        io.to(room).emit('tele:session_started', { sessionId });
      }

      // Send current status to the joiner
      socket.emit('tele:session_state', {
        sessionId,
        status:      session.status === 'waiting' ? 'active' : session.status,
        patientName: session.patient_name,
        doctorName:  session.doctor_name,
      });
    });

    // ── WebRTC: SDP Offer (from caller — usually doctor) ──
    socket.on('tele:offer', async (data: SignalingMessage) => {
      const room = roomName(data.sessionId);
      logger.debug('Tele: SDP offer forwarded', { sessionId: data.sessionId });

      await repo.logSignalingEvent(data.sessionId, 'offer', data.fromRole);

      // Forward offer to the other participant in the room
      socket.to(room).emit('tele:offer', {
        sdp:      data.sdp,
        fromRole: data.fromRole,
      });
    });

    // ── WebRTC: SDP Answer (from callee — usually patient) ─
    socket.on('tele:answer', async (data: SignalingMessage) => {
      const room = roomName(data.sessionId);
      logger.debug('Tele: SDP answer forwarded', { sessionId: data.sessionId });

      await repo.logSignalingEvent(data.sessionId, 'answer', data.fromRole);

      socket.to(room).emit('tele:answer', {
        sdp:      data.sdp,
        fromRole: data.fromRole,
      });
    });

    // ── WebRTC: ICE Candidate ─────────────────────────────
    socket.on('tele:ice_candidate', async (data: SignalingMessage) => {
      const room = roomName(data.sessionId);

      await repo.logSignalingEvent(data.sessionId, 'ice_candidate', data.fromRole);

      socket.to(room).emit('tele:ice_candidate', {
        candidate: data.candidate,
        fromRole:  data.fromRole,
      });
    });

    // ── Chat message ──────────────────────────────────────
    socket.on('tele:chat', async (data: {
      sessionId:   string;
      message:     string;
      messageType: string;
      fromRole:    string;
    }) => {
      if (!socket.user?.id) return;

      const saved = await repo.saveMessage(
        data.sessionId,
        socket.user.id,
        data.fromRole,
        data.message,
        data.messageType ?? 'text',
      );

      const room = roomName(data.sessionId);

      // Broadcast to both participants
      io.to(room).emit('tele:chat', {
        id:          saved.id,
        message:     saved.message,
        messageType: saved.message_type,
        fromRole:    data.fromRole,
        senderId:    socket.user.id,
        timestamp:   saved.created_at,
      });

      logger.debug('Tele: chat message saved', { sessionId: data.sessionId });
    });

    // ── Consent ───────────────────────────────────────────
    socket.on('tele:consent', async (data: {
      sessionId: string;
      role:      string;
      consent:   boolean;
    }) => {
      if (data.consent) {
        await repo.setConsent(data.sessionId, data.role);
      }
      socket.to(roomName(data.sessionId)).emit('tele:consent', {
        role:    data.role,
        consent: data.consent,
      });
    });

    // ── End call ──────────────────────────────────────────
    socket.on('tele:end_call', async (data: { sessionId: string; fromRole: string }) => {
      const room = roomName(data.sessionId);

      const session = await repo.findSessionById(data.sessionId);
      if (session?.started_at) {
        const durationSeconds = Math.round(
          (Date.now() - new Date(session.started_at).getTime()) / 1000,
        );
        await repo.updateSessionStatus(data.sessionId, 'ended', {
          ended_at:         new Date(),
          duration_seconds: durationSeconds,
        });

        logger.info('Tele: call ended', {
          sessionId: data.sessionId,
          duration:  durationSeconds,
          by:        data.fromRole,
        });
      }

      await repo.logSignalingEvent(data.sessionId, 'ended', data.fromRole);

      // Notify both participants
      io.to(room).emit('tele:call_ended', {
        sessionId: data.sessionId,
        endedBy:   data.fromRole,
        timestamp: new Date().toISOString(),
      });

      // Clean up room
      const socketsInRoom = await io.in(room).fetchSockets();
      socketsInRoom.forEach(s => s.leave(room));
    });

    // ── Handle disconnect ─────────────────────────────────
    socket.on('disconnect', () => {
      const ts = (socket as Socket & {
        teleSession?: { id: string; role: string };
      }).teleSession;

      if (ts) {
        socket.to(roomName(ts.id)).emit('tele:participant_left', {
          role:      ts.role,
          sessionId: ts.id,
        });
        logger.info('Tele: participant disconnected', { sessionId: ts.id, role: ts.role });
      }
    });
  });

  logger.info('WebRTC signaling handlers registered');
}
