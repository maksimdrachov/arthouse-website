import { getDatabase } from "./database.js";
import type { CreateRegistrationCodeInput, RegistrationCode } from "./types.js";

interface RegistrationCodeRow {
  code: string;
  created_by_artist_id: number | null;
  used_by_artist_id: number | null;
  used_at: string | null;
  created_at: string;
}

const mapRegistrationCode = (row: RegistrationCodeRow): RegistrationCode => ({
  code: row.code,
  createdByArtistId: row.created_by_artist_id,
  usedByArtistId: row.used_by_artist_id,
  usedAt: row.used_at,
  createdAt: row.created_at
});

export const createRegistrationCode = (input: CreateRegistrationCodeInput): RegistrationCode => {
  getDatabase()
    .prepare<[string, number | null]>(
      `
        INSERT INTO registration_codes (code, created_by_artist_id)
        VALUES (?, ?)
      `
    )
    .run(input.code, input.createdByArtistId ?? null);

  const registrationCode = findRegistrationCode(input.code);
  if (!registrationCode) {
    throw new Error("Failed to load newly created registration code.");
  }

  return registrationCode;
};

export const findRegistrationCode = (code: string): RegistrationCode | null => {
  const row = getDatabase()
    .prepare<[string], RegistrationCodeRow>("SELECT * FROM registration_codes WHERE code = ?")
    .get(code);

  return row ? mapRegistrationCode(row) : null;
};

export const listRegistrationCodes = (): RegistrationCode[] => {
  return getDatabase()
    .prepare<[], RegistrationCodeRow>("SELECT * FROM registration_codes ORDER BY created_at DESC")
    .all()
    .map(mapRegistrationCode);
};

export const listUnusedRegistrationCodes = (): RegistrationCode[] => {
  return getDatabase()
    .prepare<[], RegistrationCodeRow>(
      "SELECT * FROM registration_codes WHERE used_at IS NULL ORDER BY created_at DESC"
    )
    .all()
    .map(mapRegistrationCode);
};

export const markRegistrationCodeUsed = (
  code: string,
  usedByArtistId: number
): RegistrationCode | null => {
  getDatabase()
    .prepare<[number, string]>(
      `
        UPDATE registration_codes
        SET used_by_artist_id = ?, used_at = CURRENT_TIMESTAMP
        WHERE code = ? AND used_at IS NULL
      `
    )
    .run(usedByArtistId, code);

  return findRegistrationCode(code);
};

export const deleteRegistrationCode = (code: string): boolean => {
  const result = getDatabase()
    .prepare<[string]>("DELETE FROM registration_codes WHERE code = ?")
    .run(code);

  return result.changes > 0;
};
