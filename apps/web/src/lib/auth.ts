export type UserRole =
  | 'super_admin' | 'admin' | 'doctor' | 'nurse'
  | 'receptionist' | 'pharmacist' | 'lab_technician'
  | 'accountant' | 'radiologist' | 'patient';

export interface AuthUser {
  id:                 string;
  username:           string;
  mustChangePassword: boolean;
  roles:              UserRole[];
  permissions:        string[];
}

export interface AuthSession {
  accessToken:  string;
  refreshToken: string;
  user:         AuthUser;
}

// Primary role = first role in the list (most privileged)
export function getPrimaryRole(roles: UserRole[]): UserRole {
  const ORDER: UserRole[] = [
    'super_admin','admin','doctor','nurse','receptionist',
    'pharmacist','lab_technician','accountant','radiologist','patient',
  ];
  for (const r of ORDER) {
    if (roles.includes(r)) return r;
  }
  return roles[0] ?? 'patient';
}

export function getDashboardPath(roles: UserRole[], locale: string): string {
  const role = getPrimaryRole(roles);
  const MAP: Record<UserRole, string> = {
    super_admin:    `/${locale}/dashboard/admin`,
    admin:          `/${locale}/dashboard/admin`,
    doctor:         `/${locale}/dashboard/doctor`,
    nurse:          `/${locale}/dashboard/nurse`,
    receptionist:   `/${locale}/dashboard/receptionist`,
    pharmacist:     `/${locale}/dashboard/pharmacy`,
    lab_technician: `/${locale}/dashboard/lab`,
    accountant:     `/${locale}/dashboard/billing`,
    radiologist:    `/${locale}/dashboard/doctor`,
    patient:        `/${locale}/dashboard/patient`,
  };
  return MAP[role];
}

export function saveSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('medicore_token',        session.accessToken);
  localStorage.setItem('medicore_refresh',      session.refreshToken);
  localStorage.setItem('medicore_user',         JSON.stringify(session.user));
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const token   = localStorage.getItem('medicore_token');
  const refresh = localStorage.getItem('medicore_refresh');
  const userStr = localStorage.getItem('medicore_user');
  if (!token || !userStr) return null;
  try {
    return { accessToken: token, refreshToken: refresh ?? '', user: JSON.parse(userStr) };
  } catch { return null; }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('medicore_token');
  localStorage.removeItem('medicore_refresh');
  localStorage.removeItem('medicore_user');
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (user.roles.includes('super_admin')) return true;
  return user.permissions.includes(permission);
}
