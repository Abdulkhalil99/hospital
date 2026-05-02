'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface EmergencyVisit {
  id:              string;
  patient_name:    string;
  patient_mrn:     string | null;
  chief_complaint: string;
  triage_level:    number | null;
  triage_color:    string | null;
  status:          string;
  bed_code:        string | null;
  arrived_at:      string;
  minutes_in_ed:   number;
}

interface EmergencyState {
  visits:     EmergencyVisit[];
  connected:  boolean;
  lastAlert:  { type: string; data: unknown } | null;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export function useEmergency(token: string) {
  const [state, setState] = useState<EmergencyState>({
    visits: [], connected: false, lastAlert: null,
  });

  const socketRef    = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_URL.replace('http', 'ws')}?token=${token}`);

    ws.onopen = () => {
      setState(s => ({ ...s, connected: true }));
      // Subscribe to the emergency room
      ws.send(JSON.stringify({ event: 'join_room', data: { room: 'emergency' } }));
    };

    ws.onmessage = (msg) => {
      try {
        const { event, data } = JSON.parse(msg.data);

        if (event === 'emergency:board_updated') {
          setState(s => ({ ...s, visits: data.board ?? [] }));
        }

        if (event === 'emergency:visit_registered') {
          setState(s => ({
            ...s,
            lastAlert: { type: 'visit_registered', data },
          }));
        }

        if (event === 'emergency:critical_triage') {
          setState(s => ({
            ...s,
            lastAlert: { type: 'critical_triage', data },
          }));
          // Play alert sound in browser
          if (typeof window !== 'undefined') {
            const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          }
        }

        if (event === 'emergency:trauma_activated') {
          setState(s => ({
            ...s,
            lastAlert: { type: 'trauma_activated', data },
          }));
        }

        if (event === 'emergency:bed_assigned') {
          setState(s => ({
            ...s,
            lastAlert: { type: 'bed_assigned', data },
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
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  const clearAlert = () => setState(s => ({ ...s, lastAlert: null }));

  return { ...state, clearAlert };
}
