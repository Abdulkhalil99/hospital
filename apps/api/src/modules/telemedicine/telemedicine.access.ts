import type { JwtPayload } from '@/shared/utils/jwt.util';
import type { SessionRow } from './telemedicine.types';

export interface TelemedicineActor {
  id: string;
  roles: string[];
  permissions: string[];
}

export type ParticipantRole = 'doctor' | 'patient';

export function isTelemedicineManager(actor: TelemedicineActor): boolean {
  return actor.roles.some(role => role === 'admin' || role === 'super_admin');
}

export function getParticipantRole(session: SessionRow, userId: string): ParticipantRole | null {
  if (session.doctor_user_id === userId) return 'doctor';
  if (session.patient_user_id === userId) return 'patient';
  return null;
}

export function resolveSocketParticipant(session: SessionRow, user?: JwtPayload): {
  role: ParticipantRole; senderId: string | null;
} | null {
  if (!user) return null;
  if (user.permissions.includes('telemedicine')) {
    // Invitation JWTs carry a session subject and a server-issued role.
    if (user.sub !== session.id || !['doctor', 'patient'].includes(user.username) || !user.roles.includes(user.username)) return null;
    const role = user.username as ParticipantRole;
    const senderId = role === 'doctor' ? session.doctor_user_id : session.patient_user_id;
    if (role === 'doctor' && !senderId) return null;
    return { role, senderId: senderId ?? null };
  }
  const role = getParticipantRole(session, user.sub);
  return role ? { role, senderId: user.sub } : null;
}

export function sessionWithoutTokens(session: SessionRow): Omit<SessionRow, 'doctor_token' | 'patient_token'> {
  const { doctor_token: _doctorToken, patient_token: _patientToken, ...detail } = session;
  return detail;
}
