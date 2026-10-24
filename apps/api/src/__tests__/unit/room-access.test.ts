import { canJoinRoom } from '@/infrastructure/websocket/room-access';
import { JwtPayload } from '@/shared/utils/jwt.util';

const patient: JwtPayload = { sub: 'patient-user', username: 'patient', roles: ['patient'], permissions: [] };
const doctorRoom = 'queue:doctor:12345678-1234-1234-1234-123456789abc';

describe('WebSocket room access', () => {
  it('permits only the account owner to receive personal notifications', () => {
    expect(canJoinRoom(patient, 'user:patient-user')).toBe(true);
    expect(canJoinRoom(patient, 'user:another-user')).toBe(false);
  });

  it('requires the same permissions as queue and emergency HTTP endpoints', () => {
    expect(canJoinRoom(patient, doctorRoom)).toBe(false);
    expect(canJoinRoom(patient, 'emergency')).toBe(false);
    const staff = { ...patient, permissions: ['queue:read', 'emergency:read'] };
    expect(canJoinRoom(staff, doctorRoom)).toBe(true);
    expect(canJoinRoom(staff, 'emergency')).toBe(true);
  });

  it('allows super admins to read staff boards, retaining private room ownership', () => {
    const admin = { ...patient, roles: ['super_admin'] };
    expect(canJoinRoom(admin, doctorRoom)).toBe(true);
    expect(canJoinRoom(admin, 'emergency')).toBe(true);
    expect(canJoinRoom(admin, 'user:another-user')).toBe(false);
  });

  it('prevents telemedicine invitations from subscribing to application rooms', () => {
    const guest = { ...patient, permissions: ['telemedicine'] };
    expect(canJoinRoom(guest, 'user:patient-user')).toBe(false);
    expect(canJoinRoom(guest, doctorRoom)).toBe(false);
    expect(canJoinRoom(guest, 'emergency')).toBe(false);
  });

  it.each([undefined, null, {}, 1, 'tele:session-id', 'unknown-room', 'queue:doctor:'])('rejects unsupported room %p', (room) => {
    expect(canJoinRoom(patient, room)).toBe(false);
  });
});
