'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id:         string;
  subject:    string | null;
  body:       string;
  receivedAt: string;
  read:       boolean;
  event_type?: string;
}

const API    = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL  || 'http://localhost:3000';

export function useNotifications(token: string, userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [connected,     setConnected]     = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Load initial notifications from API
  const loadInitial = useCallback(async () => {
    if (!token) return;
    try {
      const res  = await fetch(`${API}/notifications?unreadOnly=false`, { headers });
      const data = await res.json();
      if (data.success) setNotifications(data.data);

      const res2  = await fetch(`${API}/notifications/unread-count`, { headers });
      const data2 = await res2.json();
      if (data2.success) setUnreadCount(data2.data.count);
    } catch { /* ignore */ }
  }, [token]);

  // WebSocket for real-time new notifications
  const connect = useCallback(() => {
    if (!token || !userId) return;
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_room', { room: `user:${userId}` });
    });

    socket.on('notification:new', (data) => {
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });
    socketRef.current = socket;
  }, [token, userId]);

  useEffect(() => {
    loadInitial();
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [loadInitial, connect]);

  const markRead = async (id: string) => {
    await fetch(`${API}/notifications/${id}/read`, { method: 'POST', headers });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch(`${API}/notifications/read-all`, { method: 'POST', headers });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, connected, markRead, markAllRead };
}
