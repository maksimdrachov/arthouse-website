import { getDatabase } from "./database.js";
import type { Artist, ArtistRole, CreateArtistInput, UpdateArtistInput } from "./types.js";

interface ArtistRow {
  id: number;
  slug: string;
  name: string;
  password_hash: string;
  role: ArtistRole;
  bank_account: string;
  about: string | null;
  telegram: string | null;
  instagram: string | null;
  banner_path: string | null;
  created_at: string;
  updated_at: string;
}

const mapArtist = (row: ArtistRow): Artist => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  passwordHash: row.password_hash,
  role: row.role,
  bankAccount: row.bank_account,
  about: row.about,
  telegram: row.telegram,
  instagram: row.instagram,
  bannerPath: row.banner_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createArtist = (input: CreateArtistInput): Artist => {
  const result = getDatabase()
    .prepare<
      [string, string, string, ArtistRole, string, string | null, string | null, string | null, string | null]
    >(
      `
        INSERT INTO artists (
          slug,
          name,
          password_hash,
          role,
          bank_account,
          about,
          telegram,
          instagram,
          banner_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.slug,
      input.name,
      input.passwordHash,
      input.role ?? "artist",
      input.bankAccount,
      input.about ?? null,
      input.telegram ?? null,
      input.instagram ?? null,
      input.bannerPath ?? null
    );

  const artist = findArtistById(Number(result.lastInsertRowid));
  if (!artist) {
    throw new Error("Failed to load newly created artist.");
  }

  return artist;
};

export const findArtistById = (id: number): Artist | null => {
  const row = getDatabase()
    .prepare<[number], ArtistRow>("SELECT * FROM artists WHERE id = ?")
    .get(id);

  return row ? mapArtist(row) : null;
};

export const findArtistBySlug = (slug: string): Artist | null => {
  const row = getDatabase()
    .prepare<[string], ArtistRow>("SELECT * FROM artists WHERE slug = ?")
    .get(slug);

  return row ? mapArtist(row) : null;
};

export const findStoreArtistBySlug = (slug: string): Artist | null => {
  const row = getDatabase()
    .prepare<[string], ArtistRow>("SELECT * FROM artists WHERE slug = ? AND role = 'artist'")
    .get(slug);

  return row ? mapArtist(row) : null;
};

export const findArtistByLoginIdentifier = (identifier: string): Artist | null => {
  const normalizedIdentifier = identifier.trim();
  const row = getDatabase()
    .prepare<[string, string], ArtistRow>(
      `
        SELECT *
        FROM artists
        WHERE slug = ? COLLATE NOCASE
          OR name = ? COLLATE NOCASE
        ORDER BY role = 'admin' DESC, id ASC
        LIMIT 1
      `
    )
    .get(normalizedIdentifier, normalizedIdentifier);

  return row ? mapArtist(row) : null;
};

export const listArtists = (): Artist[] => {
  return getDatabase()
    .prepare<[], ArtistRow>("SELECT * FROM artists ORDER BY name COLLATE NOCASE")
    .all()
    .map(mapArtist);
};

export const listStoreArtistsRandomized = (): Artist[] => {
  return getDatabase()
    .prepare<[], ArtistRow>("SELECT * FROM artists WHERE role = 'artist' ORDER BY RANDOM()")
    .all()
    .map(mapArtist);
};

export const listStoreArtistsWithItemsRandomized = (): Artist[] => {
  return getDatabase()
    .prepare<[], ArtistRow>(
      `
        SELECT *
        FROM artists
        WHERE role = 'artist'
          AND EXISTS (
            SELECT 1
            FROM items
            WHERE items.artist_id = artists.id
          )
        ORDER BY RANDOM()
      `
    )
    .all()
    .map(mapArtist);
};

export const updateArtist = (id: number, input: UpdateArtistInput): Artist | null => {
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.slug !== undefined) {
    assignments.push("slug = ?");
    values.push(input.slug);
  }

  if (input.name !== undefined) {
    assignments.push("name = ?");
    values.push(input.name);
  }

  if (input.passwordHash !== undefined) {
    assignments.push("password_hash = ?");
    values.push(input.passwordHash);
  }

  if (input.role !== undefined) {
    assignments.push("role = ?");
    values.push(input.role);
  }

  if (input.bankAccount !== undefined) {
    assignments.push("bank_account = ?");
    values.push(input.bankAccount);
  }

  if (input.about !== undefined) {
    assignments.push("about = ?");
    values.push(input.about);
  }

  if (input.telegram !== undefined) {
    assignments.push("telegram = ?");
    values.push(input.telegram);
  }

  if (input.instagram !== undefined) {
    assignments.push("instagram = ?");
    values.push(input.instagram);
  }

  if (input.bannerPath !== undefined) {
    assignments.push("banner_path = ?");
    values.push(input.bannerPath);
  }

  if (assignments.length === 0) {
    return findArtistById(id);
  }

  assignments.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  getDatabase()
    .prepare(`UPDATE artists SET ${assignments.join(", ")} WHERE id = ?`)
    .run(...values);

  return findArtistById(id);
};

export const deleteArtist = (id: number): boolean => {
  const result = getDatabase().prepare<[number]>("DELETE FROM artists WHERE id = ?").run(id);
  return result.changes > 0;
};

export const countArtistsByRole = (role: ArtistRole): number => {
  const row = getDatabase()
    .prepare<[ArtistRole], { count: number }>("SELECT COUNT(*) AS count FROM artists WHERE role = ?")
    .get(role);

  return row?.count ?? 0;
};
