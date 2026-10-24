'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { VideoCall } from '@/components/telemedicine/VideoCall';
import { telemedicineService } from '@/services/telemedicine.service';
import { useT } from '@/lib/i18n';

interface JoinResult {
  sessionId: string;
  role: 'doctor' | 'patient';
  patientName: string;
  doctorName: string;
  status: string;
  wsToken: string;
}

export default function TelemedicineJoinPage() {
  const params = useParams<{ locale: string; sessionId: string }>();
  const searchParams = useSearchParams();
  const t = useT(params.locale);
  const translatorRef = useRef(t);
  translatorRef.current = t;
  const [session, setSession] = useState<JoinResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError(translatorRef.current('A valid telemedicine invitation link is required.'));
      return;
    }

    let cancelled = false;
    telemedicineService.joinSession(token)
      .then((result) => {
        const joined = result as JoinResult;
        if (joined.sessionId !== params.sessionId) {
          throw new Error(translatorRef.current('This invitation does not match the requested session.'));
        }
        if (!cancelled) setSession(joined);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error
            ? reason.message
            : translatorRef.current('Unable to join this consultation.'));
        }
      });

    return () => { cancelled = true; };
  }, [params.sessionId, searchParams]);

  if (error) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>{t('Unable to join consultation')}</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p>{t('Joining consultation…')}</p>
      </main>
    );
  }

  return (
    <VideoCall
      sessionId={session.sessionId}
      wsToken={session.wsToken}
      role={session.role}
      patientName={session.patientName}
      doctorName={session.doctorName}
    />
  );
}
