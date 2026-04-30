'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

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

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!doctorId || !token) return;

    const url = `${WS_URL.replace('http', 'ws')}?token=${token}`;
    const ws  = new WebSocket(url);

    ws.onopen = () => {
      setState(s => ({ ...s, connected: true }));
      ws.send(JSON.stringify({ event: 'join_room', data: { room: `queue:doctor:${doctorId}` } }));
    };

    ws.onmessage = (msg) => {
      try {
        const { event, data } = JSON.parse(msg.data);

        if (event === 'queue:snapshot') {
          setState(s => ({
            ...s,
            tokens:                 data.tokens ?? [],
            totalWaiting:           data.totalWaiting ?? 0,
            avgConsultationMinutes: data.avgConsultationMinutes ?? 15,
          }));
        }

        if (event === 'queue:token_added') {
          setState(s => ({ ...s, tokens: [...s.tokens, data.token] }));
        }

        if (event === 'queue:patient_called') {
          setState(s => ({
            ...s,
            calledToken: data,
            tokens: s.tokens.map(t =>
              t.id === data.tokenId ? { ...t, status: 'called' } : t,
            ),
          }));
        }

        if (event === 'queue:token_updated') {
          setState(s => ({
            ...s,
            tokens: s.tokens.map(t =>
              t.id === data.tokenId ? { ...t, ...data } : t,
            ),
          }));
        }

        if (event === 'queue:token_removed') {
          setState(s => ({
            ...s,
            tokens: s.tokens.filter(t => t.id !== data.tokenId),
          }));
        }

        if (event === 'queue:wait_updated') {
          setState(s => ({
            ...s,
            avgConsultationMinutes: data.avgWait,
            totalWaiting:           data.totalWaiting,
          }));
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      setState(s => ({ ...s, connected: false }));
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();

    socketRef.current = ws;
  }, [doctorId, token]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  return state;
}
