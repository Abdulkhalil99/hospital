import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/infrastructure/logger/logger';

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

    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
      (socket as Socket & { user: unknown }).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info('WS client connected', { socketId: socket.id });

    socket.on('join_room', (data: { room: string }) => {
      socket.join(data.room);
      logger.debug('WS join', { socketId: socket.id, room: data.room });
    });

    socket.on('leave_room', (data: { room: string }) => {
      socket.leave(data.room);
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
  getIO().to(`queue:doctor:${doctorId}`).emit(event, data);
}
