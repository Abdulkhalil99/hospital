import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import {
  CreatePatientInput, PatientRow,
  AllergyInput, FamilyMemberInput,
} from './patients.types';

export class PatientsRepository {
  private db: Pool = getDb();

  async findById(id: string): Promise<PatientRow | null> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients WHERE id = $1 AND is_deleted = FALSE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByMrn(mrn: string): Promise<PatientRow | null> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients WHERE mrn = $1 AND is_deleted = FALSE`,
      [mrn],
    );
    return rows[0] ?? null;
  }

  async findByPhone(phone: string): Promise<PatientRow | null> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients
       WHERE phone = $1 AND is_deleted = FALSE LIMIT 1`,
      [phone],
    );
    return rows[0] ?? null;
  }

  async findByNationalId(nationalId: string): Promise<PatientRow | null> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients
       WHERE national_id = $1 AND is_deleted = FALSE LIMIT 1`,
      [nationalId],
    );
    return rows[0] ?? null;
  }

  async findPossibleDuplicates(
    firstName: string, lastName: string, dob: string,
  ): Promise<PatientRow[]> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients
       WHERE is_deleted = FALSE
         AND LOWER(first_name) = LOWER($1)
         AND LOWER(last_name)  = LOWER($2)
         AND date_of_birth     = $3::DATE
       LIMIT 5`,
      [firstName, lastName, dob],
    );
    return rows;
  }

  async search(
    q: string, limit: number, offset: number,
    gender?: string, active?: boolean,
  ): Promise<{ rows: PatientRow[]; total: number }> {
    const like   = `%${q}%`;
    const params: unknown[] = [like, limit, offset];
    let   where  = `(
      first_name ILIKE $1 OR last_name ILIKE $1 OR
      mrn        ILIKE $1 OR phone     ILIKE $1 OR
      first_name_native ILIKE $1 OR last_name_native ILIKE $1
    )`;

    if (gender) { params.push(gender); where += ` AND gender = $${params.length}`; }
    if (active !== undefined) { params.push(active); where += ` AND is_active = $${params.length}`; }

    const countParams = params.filter((_, i) => i !== 1 && i !== 2);
    const countWhere  = where.replace('$1', `$1`);

    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients
       WHERE is_deleted = FALSE AND ${where}
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      params,
    );

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM patients.patients
       WHERE is_deleted = FALSE AND ${countWhere}`,
      countParams,
    );

    return { rows, total: Number(countResult.rows[0]?.count ?? 0) };
  }

  async countAll(): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM patients.patients`,
    );
    return Number(rows[0].count);
  }

  async create(
    data: CreatePatientInput, mrn: string, createdBy: string,
  ): Promise<PatientRow> {
    const { rows } = await this.db.query<PatientRow>(
      `INSERT INTO patients.patients
         (mrn, first_name, last_name, first_name_native, last_name_native,
          date_of_birth, gender, blood_type, phone, phone_alt,
          national_id, email, address, city, country,
          preferred_language, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        mrn,
        data.firstName, data.lastName,
        data.firstNameNative ?? null, data.lastNameNative ?? null,
        data.dateOfBirth, data.gender, data.bloodType,
        data.phone, data.phoneAlt ?? null,
        data.nationalId ?? null, data.email ?? null,
        data.address ?? null, data.city ?? null,
        data.country ?? 'AF', data.preferredLanguage ?? 'fa',
        createdBy,
      ],
    );
    return rows[0];
  }

  async update(
    id: string, data: Partial<CreatePatientInput>, updatedBy: string,
  ): Promise<PatientRow | null> {
    const colMap: Record<string, string> = {
      firstName: 'first_name', lastName: 'last_name',
      firstNameNative: 'first_name_native', lastNameNative: 'last_name_native',
      dateOfBirth: 'date_of_birth', gender: 'gender', bloodType: 'blood_type',
      phone: 'phone', phoneAlt: 'phone_alt', nationalId: 'national_id',
      email: 'email', address: 'address', city: 'city',
      country: 'country', preferredLanguage: 'preferred_language',
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(colMap)) {
      if (key in data) {
        sets.push(`${col} = $${idx++}`);
        vals.push((data as Record<string, unknown>)[key] ?? null);
      }
    }
    if (!sets.length) return this.findById(id);

    sets.push(`updated_by = $${idx++}`, `updated_at = NOW()`);
    vals.push(updatedBy, id);

    const { rows } = await this.db.query<PatientRow>(
      `UPDATE patients.patients SET ${sets.join(', ')}
       WHERE id = $${idx} AND is_deleted = FALSE RETURNING *`,
      vals,
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE patients.patients
       SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND is_deleted = FALSE`,
      [deletedBy, id],
    );
    return (rowCount ?? 0) > 0;
  }

  // ── Allergies ─────────────────────────────────────────────
  async getAllergies(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM patients.allergies
       WHERE patient_id = $1 AND is_active = TRUE
       ORDER BY severity DESC`,
      [patientId],
    );
    return rows;
  }

  async addAllergy(
    patientId: string, data: AllergyInput, recordedBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO patients.allergies
         (patient_id, allergen, reaction, severity, onset_date, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        patientId, data.allergen, data.reaction, data.severity,
        data.onsetDate ?? null, data.notes ?? null, recordedBy,
      ],
    );
    return rows[0];
  }

  async removeAllergy(allergyId: string, patientId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE patients.allergies
       SET is_active = FALSE
       WHERE id = $1 AND patient_id = $2`,
      [allergyId, patientId],
    );
    return (rowCount ?? 0) > 0;
  }

  // ── OTP ───────────────────────────────────────────────────
  async saveOtp(
    target: string, targetType: string, codeHash: string,
    purpose: string, expiresAt: Date, patientId?: string,
  ): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO patients.otp_codes
         (target, target_type, code_hash, purpose, expires_at, patient_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [target, targetType, codeHash, purpose, expiresAt, patientId ?? null],
    );
    return rows[0].id;
  }

  async findLatestOtp(target: string, purpose: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM patients.otp_codes
       WHERE target = $1 AND purpose = $2
         AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [target, purpose],
    );
    return rows[0] ?? null;
  }

  async incrementOtpAttempts(otpId: string): Promise<number> {
    const { rows } = await this.db.query<{ attempts: number }>(
      `UPDATE patients.otp_codes
       SET attempts = attempts + 1
       WHERE id = $1 RETURNING attempts`,
      [otpId],
    );
    return rows[0].attempts;
  }

  async markOtpUsed(otpId: string): Promise<void> {
    await this.db.query(
      `UPDATE patients.otp_codes SET used_at = NOW() WHERE id = $1`,
      [otpId],
    );
  }

  async countOtpsSentToday(target: string): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM patients.otp_codes
       WHERE target = $1 AND created_at >= CURRENT_DATE`,
      [target],
    );
    return Number(rows[0].count);
  }

  // ── Family members ────────────────────────────────────────
  async getFamilyMembers(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT fm.*,
              p.first_name, p.last_name, p.mrn,
              p.date_of_birth, p.phone
       FROM patients.family_members fm
       JOIN patients.patients p ON p.id = fm.member_patient_id
       WHERE fm.primary_patient_id = $1 AND fm.status = 'active'`,
      [patientId],
    );
    return rows;
  }

  async addFamilyMember(
    primaryId: string, data: FamilyMemberInput, linkedBy: string,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO patients.family_members
         (primary_patient_id, member_patient_id, relationship, access_level, linked_by, status)
       VALUES ($1,$2,$3,$4,$5,'active') RETURNING *`,
      [primaryId, data.memberPatientId, data.relationship, data.accessLevel, linkedBy],
    );
    return rows[0];
  }

  async removeFamilyMember(
    primaryId: string, memberId: string, revokedBy: string,
  ): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE patients.family_members
       SET status = 'revoked', revoked_at = NOW(), revoked_by = $3
       WHERE primary_patient_id = $1 AND member_patient_id = $2 AND status = 'active'`,
      [primaryId, memberId, revokedBy],
    );
    return (rowCount ?? 0) > 0;
  }

  async getMedicalHistory(patientId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM patients.v_medical_history WHERE patient_id = $1`,
      [patientId],
    );
    return rows[0] ?? null;
  }
}
