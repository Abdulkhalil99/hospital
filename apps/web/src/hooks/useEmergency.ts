'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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

  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      setState(s => ({ ...s, connected: true }));
      socket.emit('join_room', { room: 'emergency' });
    });

    socket.on('emergency:board_updated', (data) => {
      setState(s => ({ ...s, visits: data.board ?? [] }));
    });

    socket.on('emergency:visit_registered', (data) => {
      setState(s => ({ ...s, lastAlert: { type: 'visit_registered', data } }));
    });

    socket.on('emergency:critical_triage', (data) => {
      setState(s => ({ ...s, lastAlert: { type: 'critical_triage', data } }));
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext
          || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    });

    socket.on('emergency:trauma_activated', (data) => {
      setState(s => ({ ...s, lastAlert: { type: 'trauma_activated', data } }));
    });

    socket.on('emergency:bed_assigned', (data) => {
      setState(s => ({ ...s, lastAlert: { type: 'bed_assigned', data } }));
    });

    socket.on('disconnect', () => {
      setState(s => ({ ...s, connected: false }));
    });
    socketRef.current = socket;
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  const clearAlert = () => setState(s => ({ ...s, lastAlert: null }));

  return { ...state, clearAlert };
}
