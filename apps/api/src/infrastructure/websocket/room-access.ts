import { JwtPayload } from '@/shared/utils/jwt.util';

export function canJoinRoom(user: JwtPayload, room: unknown): boolean {
  if (typeof room !== 'string' || !user.sub || user.permissions?.includes('telemedicine')) return false;

  if (room.startsWith('user:')) return room === `user:${user.sub}`;

  const hasPermission = (permission: string): boolean =>
    user.roles?.includes('super_admin') || user.permissions?.includes(permission) || false;

  if (room === 'emergency') return hasPermission('emergency:read');
  if (/^queue:doctor:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(room)) {
    return hasPermission('queue:read');
  }

  // Telemedicine rooms use their session-specific join and ownership checks.
  return false;
}
