// Central nav definitions — all dashboards import from here
// Labels are translation keys, resolved in each page using useT()

export type NavDef = { labelKey: string; icon: string; path: string };

export const DOCTOR_NAV: NavDef[] = [
  { labelKey: 'nav.queue',         icon: '📋', path: '/dashboard/doctor' },
  { labelKey: 'nav.appointments',  icon: '📅', path: '/dashboard/doctor/appointments' },
  { labelKey: 'nav.patients',      icon: '👥', path: '/dashboard/doctor/patients' },
  { labelKey: 'nav.emr',           icon: '📝', path: '/dashboard/doctor/emr' },
  { labelKey: 'nav.prescriptions', icon: '💊', path: '/dashboard/doctor/prescriptions' },
  { labelKey: 'nav.lab',           icon: '🧪', path: '/dashboard/doctor/lab' },
];

export const ADMIN_NAV: NavDef[] = [
  { labelKey: 'nav.overview',      icon: '🏠', path: '/dashboard/admin' },
  { labelKey: 'nav.patients',      icon: '👥', path: '/dashboard/admin/patients' },
  { labelKey: 'nav.doctors',       icon: '👨‍⚕️', path: '/dashboard/admin/doctors' },
  { labelKey: 'nav.appointments',  icon: '📅', path: '/dashboard/admin/appointments' },
  { labelKey: 'nav.billing',       icon: '💰', path: '/dashboard/admin/billing' },
  { labelKey: 'nav.reports',       icon: '📊', path: '/dashboard/admin/reports' },
  { labelKey: 'nav.settings',      icon: '⚙️', path: '/dashboard/admin/settings' },
];

export const RECEPTIONIST_NAV: NavDef[] = [
  { labelKey: 'nav.checkin',       icon: '✅', path: '/dashboard/receptionist' },
  { labelKey: 'nav.book',          icon: '📅', path: '/dashboard/receptionist/book' },
  { labelKey: 'nav.patients',      icon: '👥', path: '/dashboard/receptionist/patients' },
  { labelKey: 'nav.today',         icon: '📋', path: '/dashboard/receptionist/today' },
];

export const PHARMACY_NAV: NavDef[] = [
  { labelKey: 'nav.prescriptions', icon: '💊', path: '/dashboard/pharmacy' },
  { labelKey: 'nav.inventory',     icon: '📦', path: '/dashboard/pharmacy/inventory' },
  { labelKey: 'nav.dispense',      icon: '✅', path: '/dashboard/pharmacy/dispense' },
  { labelKey: 'nav.critical',      icon: '⚠️', path: '/dashboard/pharmacy/alerts' },
];

export const LAB_NAV: NavDef[] = [
  { labelKey: 'nav.worklist',      icon: '🧪', path: '/dashboard/lab' },
  { labelKey: 'nav.results',       icon: '✏️', path: '/dashboard/lab/results' },
  { labelKey: 'nav.critical',      icon: '🚨', path: '/dashboard/lab/critical' },
  { labelKey: 'nav.catalog',       icon: '📋', path: '/dashboard/lab/catalog' },
];

export const NURSE_NAV: NavDef[] = [
  { labelKey: 'nav.queue',         icon: '📋', path: '/dashboard/nurse' },
  { labelKey: 'nav.vitals',        icon: '💓', path: '/dashboard/nurse/vitals' },
  { labelKey: 'nav.triage',        icon: '🚨', path: '/dashboard/nurse/triage' },
  { labelKey: 'nav.patients',      icon: '👥', path: '/dashboard/nurse/patients' },
];

export const BILLING_NAV: NavDef[] = [
  { labelKey: 'nav.invoices',      icon: '📄', path: '/dashboard/billing' },
  { labelKey: 'nav.payments',      icon: '💳', path: '/dashboard/billing/payments' },
  { labelKey: 'nav.outstanding',   icon: '⏳', path: '/dashboard/billing/outstanding' },
  { labelKey: 'nav.report',        icon: '📊', path: '/dashboard/billing/report' },
];

export const EMERGENCY_NAV: NavDef[] = [
  { labelKey: 'nav.emergency',     icon: '🏥', path: '/dashboard/emergency' },
  { labelKey: 'nav.triage',        icon: '🚨', path: '/dashboard/emergency/triage' },
  { labelKey: 'nav.beds',          icon: '🛏️', path: '/dashboard/emergency/beds' },
  { labelKey: 'nav.trauma',        icon: '⚡', path: '/dashboard/emergency/trauma' },
];

export const PATIENT_NAV: NavDef[] = [
  { labelKey: 'nav.myhealthcare',  icon: '❤️',  path: '/dashboard/patient' },
  { labelKey: 'nav.myappointments',icon: '📅',  path: '/dashboard/patient/appointments' },
  { labelKey: 'nav.myresults',     icon: '🧪',  path: '/dashboard/patient/results' },
  { labelKey: 'nav.prescriptions', icon: '💊',  path: '/dashboard/patient/prescriptions' },
  { labelKey: 'nav.mybills',       icon: '💰',  path: '/dashboard/patient/bills' },
];

// Resolve nav for a locale
export function resolveNav(
  defs:   NavDef[],
  locale: string,
  t:      (key: string) => string,
): { label: string; icon: string; path: string }[] {
  return defs.map(d => ({
    label: t(d.labelKey),
    icon:  d.icon,
    path:  `/${locale}${d.path}`,
  }));
}

// Get nav for a role
export function getNavForRole(role: string): NavDef[] {
  switch (role) {
    case 'doctor':       return DOCTOR_NAV;
    case 'admin':        return ADMIN_NAV;
    case 'receptionist': return RECEPTIONIST_NAV;
    case 'pharmacy':     return PHARMACY_NAV;
    case 'lab':          return LAB_NAV;
    case 'nurse':        return NURSE_NAV;
    case 'billing':      return BILLING_NAV;
    case 'emergency':    return EMERGENCY_NAV;
    case 'patient':      return PATIENT_NAV;
    default:            return [];
  }
}