import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { logger } from '../logger/logger';

let io: SocketServer | null = null;

export function initWebSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGINS?.split(',') || [] },
  });

  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { socketId: socket.id });
    socket.on('disconnect', () =>
      logger.info('WebSocket client disconnected', { socketId: socket.id }),
    );
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('WebSocket server not initialized');
  return io;
}
