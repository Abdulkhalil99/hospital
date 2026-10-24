import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { config } from '@/config';
import { logger } from '@/infrastructure/logger/logger';
import { verifyAccessToken } from '@/shared/utils/jwt.util';
import { canJoinRoom } from './room-access';

let io: SocketServer | null = null;

export function initWebSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: config.cors.origins, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.query.token as string;

    if (typeof token !== 'string' || !token) {
      return next(new Error('Authentication required'));
    }
    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // Register telemedicine WebRTC signaling
  const { registerSignalingHandlers } = require('../../modules/telemedicine/signaling.handler');
  registerSignalingHandlers(io);

  io.on('connection', (socket: Socket) => {
    logger.info('WS client connected', { socketId: socket.id });

    socket.on('join_room', (data?: { room?: unknown }) => {
      const user = socket.data.user;
      if (!user || !canJoinRoom(user, data?.room)) {
        socket.emit('room:error', { message: 'Not authorized to join this room' });
        return;
      }
      const room = data!.room as string;
      socket.join(room);
      logger.debug('WS join', { socketId: socket.id, room });
    });

    socket.on('leave_room', (data?: { room?: unknown }) => {
      if (typeof data?.room === 'string') socket.leave(data.room);
    });

    socket.on('disconnect', () => {
      logger.info('WS client disconnected', { socketId: socket.id });
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('WebSocket not initialised — call initWebSocket() first');
  return io;
}

// Emit to everyone subscribed to a doctor's queue room
export function emitToQueue(doctorId: string, event: string, data: unknown): void {
  io?.to(`queue:doctor:${doctorId}`).emit(event, data);
}

// Emit to all clients subscribed to the emergency department room
export function emitToEmergency(event: string, data: unknown): void {
  try {
    getIO().to('emergency').emit(event, data);
  } catch {
    // WS not initialised yet — ignore during startup
  }
}
