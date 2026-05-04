'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface Message {
  id:          string;
  message:     string;
  fromRole:    string;
  timestamp:   string;
}

interface VideoCallProps {
  sessionId:   string;
  wsToken:     string;
  role:        'doctor' | 'patient';
  patientName: string;
  doctorName:  string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Add TURN servers for production:
  // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
];

export function VideoCall({ sessionId, wsToken, role, patientName, doctorName }: VideoCallProps) {
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef        = useRef<RTCPeerConnection | null>(null);
  const socketRef      = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [status,     setStatus]     = useState<'connecting' | 'waiting' | 'active' | 'ended'>('connecting');
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [chatInput,  setChatInput]  = useState('');
  const [camOn,      setCamOn]      = useState(true);
  const [micOn,      setMicOn]      = useState(true);
  const [showChat,   setShowChat]   = useState(false);
  const [unread,     setUnread]     = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);

  const otherName = role === 'doctor' ? patientName : doctorName;

  // ── WebSocket setup ───────────────────────────────────────
  const sendWS = useCallback((event: string, data: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event, data }));
    }
  }, []);

  // ── WebRTC peer connection ────────────────────────────────
  const createPeer = useCallback(() => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        sendWS('tele:ice_candidate', {
          sessionId,
          fromRole: role,
          candidate: e.candidate,
        });
      }
    };

    peer.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setStatus('active');
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        setStatus('ended');
      }
    };

    return peer;
  }, [sessionId, role, sendWS]);

  // ── Get local media ───────────────────────────────────────
  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error('Media access denied:', err);
      return null;
    }
  }, []);

  // ── Doctor initiates offer ────────────────────────────────
  const initiateCall = useCallback(async () => {
    const peer   = createPeer();
    peerRef.current = peer;

    const stream = await startLocalMedia();
    if (!stream) return;

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    sendWS('tele:offer', { sessionId, fromRole: role, sdp: offer });
  }, [createPeer, startLocalMedia, sendWS, sessionId, role]);

  // ── Main WebSocket + event routing ───────────────────────
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL.replace('http', 'ws')}?token=${wsToken}`);
    socketRef.current = ws;

    ws.onopen = () => {
      sendWS('tele:join', { sessionId, role });
      setStatus('waiting');
    };

    ws.onmessage = async (msg) => {
      const { event, data } = JSON.parse(msg.data);

      if (event === 'tele:session_started') {
        // Doctor initiates offer when session becomes active
        if (role === 'doctor') initiateCall();
      }

      if (event === 'tele:participant_joined') {
        if (role === 'doctor' && data.role === 'patient') {
          initiateCall();
        }
      }

      if (event === 'tele:offer' && role === 'patient') {
        const peer = createPeer();
        peerRef.current = peer;

        const stream = await startLocalMedia();
        if (stream) stream.getTracks().forEach(t => peer.addTrack(t, stream));

        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        sendWS('tele:answer', { sessionId, fromRole: role, sdp: answer });
      }

      if (event === 'tele:answer' && role === 'doctor') {
        await peerRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }

      if (event === 'tele:ice_candidate') {
        try {
          await peerRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch { /* ignore stale candidates */ }
      }

      if (event === 'tele:chat') {
        setMessages(prev => [...prev, data]);
        if (!showChat) setUnread(prev => prev + 1);
      }

      if (event === 'tele:call_ended') {
        setStatus('ended');
        localStreamRef.current?.getTracks().forEach(t => t.stop());
      }

      if (event === 'tele:participant_left') {
        setStatus('waiting');
      }
    };

    ws.onclose = () => {
      if (status !== 'ended') setStatus('ended');
    };

    return () => {
      ws.close();
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [wsToken, sessionId, role]);

  // ── Controls ──────────────────────────────────────────────
  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(prev => !prev);
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(prev => !prev);
  };

  const endCall = () => {
    sendWS('tele:end_call', { sessionId, fromRole: role });
    setStatus('ended');
    localStreamRef.current?.getTracks().forEach(t => t.stop());
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    sendWS('tele:chat', {
      sessionId, message: chatInput.trim(),
      messageType: 'text', fromRole: role,
    });
    setChatInput('');
  };

  const giveConsent = () => {
    sendWS('tele:consent', { sessionId, role, consent: true });
    setConsentGiven(true);
  };

  // ── Consent screen ────────────────────────────────────────
  if (role === 'patient' && !consentGiven) {
    return (
      <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>
          Consent for Telemedicine Consultation
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
          By joining this video consultation, you consent to the telemedicine session with
          Dr. {doctorName}. The consultation is not recorded unless explicitly agreed.
          Your privacy is protected. You may end the call at any time.
        </p>
        <button onClick={giveConsent} style={{ width: '100%', padding: '10px 0', fontSize: 14 }}>
          I Agree — Join Consultation
        </button>
      </div>
    );
  }

  // ── Ended screen ──────────────────────────────────────────
  if (status === 'ended') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Call ended</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 8 }}>
          The telemedicine session has ended.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#111', color: '#fff' }}>

      {/* ── Video area ────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Remote video (full screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#222' }}
        />

        {/* Status overlay */}
        {status === 'waiting' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 16 }}>Waiting for {otherName}...</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
                Session ID: {sessionId.slice(0, 8)}
              </div>
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div style={{
          position: 'absolute', bottom: 90, right: 16,
          width: 160, height: 120, borderRadius: 8, overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.3)',
          background: '#333',
        }}>
          <video
            ref={localVideoRef}
            autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          {!camOn && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#333', fontSize: 24,
            }}>📷</div>
          )}
        </div>

        {/* Call controls */}
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 12,
        }}>
          {[
            { label: micOn ? '🎤' : '🔇', action: toggleMic, active: micOn },
            { label: camOn ? '📹' : '📷', action: toggleCam, active: camOn },
            { label: showChat ? '💬●' : '💬', action: () => { setShowChat(p => !p); setUnread(0); }, active: showChat },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              style={{
                width: 48, height: 48, borderRadius: '50%', border: 'none',
                background: btn.active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {btn.label}
              {btn.label.includes('💬') && unread > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: '#E24B4A', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{unread}</span>
              )}
            </button>
          ))}
          <button
            onClick={endCall}
            style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none',
              background: '#E24B4A', color: '#fff', fontSize: 20, cursor: 'pointer',
            }}
          >📵</button>
        </div>
      </div>

      {/* ── Chat panel ────────────────────────────────────── */}
      {showChat && (
        <div style={{
          width: 300, background: '#1a1a1a',
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 500 }}>
            Chat with {otherName}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 40 }}>
                No messages yet
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} style={{
                maxWidth: '80%', padding: '7px 10px', borderRadius: 8, fontSize: 12,
                alignSelf: m.fromRole === role ? 'flex-end' : 'flex-start',
                background: m.fromRole === role ? '#185FA5' : 'rgba(255,255,255,0.1)',
              }}>
                {m.message}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 8 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="Type a message..."
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: 12,
              }}
            />
            <button
              onClick={sendChat}
              style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: '#185FA5', color: '#fff', fontSize: 12, cursor: 'pointer',
              }}
            >Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
