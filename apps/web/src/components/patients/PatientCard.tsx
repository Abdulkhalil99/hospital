'use client';

interface Patient {
  id: string; mrn: string; first_name: string; last_name: string;
  date_of_birth: string; gender: string; blood_type: string;
  phone: string; email?: string; has_allergies: boolean;
  is_vip: boolean; is_active: boolean; preferred_language: string;
}

export function PatientCard({ patient }: { patient: Patient }) {
  const initials = (patient.first_name[0] + patient.last_name[0]).toUpperCase();

  const age = Math.floor(
    (Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)
  );

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '1rem 1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--color-background-info)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 500, color: 'var(--color-text-info)',
          flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 15 }}>
            {patient.first_name} {patient.last_name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>
            MRN: {patient.mrn}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {patient.has_allergies && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 3, fontWeight: 500,
              background: '#FCEBEB', color: '#791F1F',
            }}>ALLERGY</span>
          )}
          {patient.is_vip && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 3, fontWeight: 500,
              background: '#FAEEDA', color: '#633806',
            }}>VIP</span>
          )}
          {!patient.is_active && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 3, fontWeight: 500,
              background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)',
            }}>INACTIVE</span>
          )}
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 12 }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['Date of birth', `${new Date(patient.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} (${age} yrs)`],
              ['Gender',        patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)],
              ['Blood type',    patient.blood_type],
              ['Phone',         patient.phone],
              ...(patient.email ? [['Email', patient.email]] : []),
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ color: 'var(--color-text-secondary)', padding: '3px 0', width: '40%' }}>{label}</td>
                <td style={{ padding: '3px 0', color: 'var(--color-text-primary)' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
