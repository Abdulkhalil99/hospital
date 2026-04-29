// ── ONLY SQL in this file. Zero business logic. ──────────────────────

import { Pool } from 'pg';
import { getDb } from '@/infrastructure/database/db.client';
import { CreatePatientInput, PatientRow } from './patients.types';

export class PatientsRepository {
  private db: Pool = getDb();

  async findById(id: string): Promise<PatientRow | null> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients
       WHERE id = $1 AND is_deleted = FALSE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByMrn(mrn: string): Promise<PatientRow | null> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients
       WHERE mrn = $1 AND is_deleted = FALSE`,
      [mrn],
    );
    return rows[0] ?? null;
  }

  async findByNationalId(nationalId: string): Promise<PatientRow | null> {
    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients
       WHERE national_id = $1 AND is_deleted = FALSE`,
      [nationalId],
    );
    return rows[0] ?? null;
  }

  async search(
    query: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: PatientRow[]; total: number }> {
    const like = `%${query}%`;

    const { rows } = await this.db.query<PatientRow>(
      `SELECT * FROM patients.patients
       WHERE is_deleted = FALSE
         AND (first_name ILIKE $1
           OR last_name  ILIKE $1
           OR mrn        ILIKE $1
           OR phone      ILIKE $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [like, limit, offset],
    );

    const { rows: countRows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM patients.patients
       WHERE is_deleted = FALSE
         AND (first_name ILIKE $1 OR last_name ILIKE $1
           OR mrn ILIKE $1 OR phone ILIKE $1)`,
      [like],
    );

    return { rows, total: Number(countRows[0].count) };
  }

  async countAll(): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM patients.patients`,
    );
    return Number(rows[0].count);
  }

  async create(
    data:      CreatePatientInput,
    mrn:       string,
    createdBy: string,
  ): Promise<PatientRow> {
    const { rows } = await this.db.query<PatientRow>(
      `INSERT INTO patients.patients
         (mrn, first_name, last_name, date_of_birth, gender,
          blood_type, phone, national_id, email, address, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        mrn,
        data.firstName,
        data.lastName,
        data.dateOfBirth,
        data.gender,
        data.bloodType,
        data.phone,
        data.nationalId ?? null,
        data.email      ?? null,
        data.address    ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  async update(
    id:        string,
    data:      Partial<CreatePatientInput>,
    updatedBy: string,
  ): Promise<PatientRow | null> {
    // Build SET clause dynamically from provided fields only
    const columnMap: Record<string, string> = {
      firstName:   'first_name',
      lastName:    'last_name',
      dateOfBirth: 'date_of_birth',
      gender:      'gender',
      bloodType:   'blood_type',
      phone:       'phone',
      nationalId:  'national_id',
      email:       'email',
      address:     'address',
    };

    const setClauses: string[]  = [];
    const values:     unknown[] = [];
    let   idx = 1;

    for (const [key, col] of Object.entries(columnMap)) {
      if (key in data) {
        setClauses.push(`${col} = $${idx++}`);
        values.push((data as Record<string, unknown>)[key] ?? null);
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    setClauses.push(`updated_by = $${idx++}`, `updated_at = NOW()`);
    values.push(updatedBy, id);

    const { rows } = await this.db.query<PatientRow>(
      `UPDATE patients.patients
       SET ${setClauses.join(', ')}
       WHERE id = $${idx} AND is_deleted = FALSE
       RETURNING *`,
      values,
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
}