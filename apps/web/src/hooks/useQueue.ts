'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface QueueToken {
  id:           string;
  display:      string;
  tokenNumber:  number;
  patientName:  string;
  patientMrn:   string;
  status:       string;
  priority:     number;
  estimatedWaitMinutes?: number;
}

interface QueueState {
  tokens:                 QueueToken[];
  totalWaiting:           number;
  avgConsultationMinutes: number;
  connected:              boolean;
  calledToken:            QueueToken | null;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export function useQueue(doctorId: string, token: string) {
  const [state, setState] = useState<QueueState>({
    tokens: [], totalWaiting: 0,
    avgConsultationMinutes: 15,
    connected: false, calledToken: null,
  });

  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!doctorId || !token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      setState(s => ({ ...s, connected: true }));
      socket.emit('join_room', { room: `queue:doctor:${doctorId}` });
    });

    socket.on('queue:snapshot', (data) => {
      setState(s => ({
        ...s,
        tokens:                 data.tokens ?? [],
        totalWaiting:           data.totalWaiting ?? 0,
        avgConsultationMinutes: data.avgConsultationMinutes ?? 15,
      }));
    });

    socket.on('queue:token_added', (data) => {
      setState(s => ({ ...s, tokens: [...s.tokens, data.token] }));
    });

    socket.on('queue:patient_called', (data) => {
      setState(s => ({
        ...s,
        calledToken: data,
        tokens: s.tokens.map(t =>
          t.id === data.tokenId ? { ...t, status: 'called' } : t,
        ),
      }));
    });

    socket.on('queue:token_updated', (data) => {
      setState(s => ({
        ...s,
        tokens: s.tokens.map(t =>
          t.id === data.tokenId ? { ...t, ...data } : t,
        ),
      }));
    });

    socket.on('queue:token_removed', (data) => {
      setState(s => ({
        ...s,
        tokens: s.tokens.filter(t => t.id !== data.tokenId),
      }));
    });

    socket.on('queue:wait_updated', (data) => {
      setState(s => ({
        ...s,
        avgConsultationMinutes: data.avgWait,
        totalWaiting:           data.totalWaiting,
      }));
    });

    socket.on('disconnect', () => {
      setState(s => ({ ...s, connected: false }));
    });

    socketRef.current = socket;
  }, [doctorId, token]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  return state;
}
