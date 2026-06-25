import { getDatabase } from "./database.js";
import type { CreateItemInput, Item, ItemAvailability, UpdateItemInput } from "./types.js";

interface ItemRow {
  id: number;
  artist_id: number;
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  description: string;
  availability: ItemAvailability;
  created_at: string;
  updated_at: string;
}

const mapItem = (row: ItemRow): Item => ({
  id: row.id,
  artistId: row.artist_id,
  slug: row.slug,
  name: row.name,
  priceCents: row.price_cents,
  currency: row.currency,
  description: row.description,
  availability: row.availability,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createItem = (input: CreateItemInput): Item => {
  const result = getDatabase()
    .prepare<[number, string, string, number, string, string, ItemAvailability]>(
      `
        INSERT INTO items (
          artist_id,
          slug,
          name,
          price_cents,
          currency,
          description,
          availability
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.artistId,
      input.slug,
      input.name,
      input.priceCents,
      input.currency ?? "EUR",
      input.description ?? "",
      input.availability ?? "available"
    );

  const item = findItemById(Number(result.lastInsertRowid));
  if (!item) {
    throw new Error("Failed to load newly created item.");
  }

  return item;
};

export const findItemById = (id: number): Item | null => {
  const row = getDatabase()
    .prepare<[number], ItemRow>("SELECT * FROM items WHERE id = ?")
    .get(id);

  return row ? mapItem(row) : null;
};

export const findItemByArtistAndSlug = (artistId: number, slug: string): Item | null => {
  const row = getDatabase()
    .prepare<[number, string], ItemRow>("SELECT * FROM items WHERE artist_id = ? AND slug = ?")
    .get(artistId, slug);

  return row ? mapItem(row) : null;
};

export const findItemByArtistSlugAndItemSlug = (
  artistSlug: string,
  itemSlug: string
): Item | null => {
  const row = getDatabase()
    .prepare<[string, string], ItemRow>(
      `
        SELECT items.*
        FROM items
        JOIN artists ON artists.id = items.artist_id
        WHERE artists.slug = ? AND artists.role = 'artist' AND items.slug = ?
      `
    )
    .get(artistSlug, itemSlug);

  return row ? mapItem(row) : null;
};

export const listItemsByArtistId = (artistId: number): Item[] => {
  return getDatabase()
    .prepare<[number], ItemRow>(
      "SELECT * FROM items WHERE artist_id = ? ORDER BY created_at DESC, id DESC"
    )
    .all(artistId)
    .map(mapItem);
};

export const listItemsByAvailability = (availability: ItemAvailability): Item[] => {
  return getDatabase()
    .prepare<[ItemAvailability], ItemRow>(
      "SELECT * FROM items WHERE availability = ? ORDER BY created_at DESC, id DESC"
    )
    .all(availability)
    .map(mapItem);
};

export const listRandomItems = (limit: number): Item[] => {
  return getDatabase()
    .prepare<[number], ItemRow>(
      `
        SELECT items.*
        FROM items
        JOIN artists ON artists.id = items.artist_id
        WHERE artists.role = 'artist' AND items.availability = 'available'
        ORDER BY RANDOM()
        LIMIT ?
      `
    )
    .all(limit)
    .map(mapItem);
};

export const listSoldItems = (): Item[] => {
  return listItemsByAvailability("sold");
};

export const updateItem = (id: number, input: UpdateItemInput): Item | null => {
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

  if (input.priceCents !== undefined) {
    assignments.push("price_cents = ?");
    values.push(input.priceCents);
  }

  if (input.currency !== undefined) {
    assignments.push("currency = ?");
    values.push(input.currency);
  }

  if (input.description !== undefined) {
    assignments.push("description = ?");
    values.push(input.description);
  }

  if (input.availability !== undefined) {
    assignments.push("availability = ?");
    values.push(input.availability);
  }

  if (assignments.length === 0) {
    return findItemById(id);
  }

  assignments.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  getDatabase()
    .prepare(`UPDATE items SET ${assignments.join(", ")} WHERE id = ?`)
    .run(...values);

  return findItemById(id);
};

export const updateItemAvailability = (
  id: number,
  availability: ItemAvailability
): Item | null => {
  return updateItem(id, { availability });
};

export const deleteItem = (id: number): boolean => {
  const result = getDatabase().prepare<[number]>("DELETE FROM items WHERE id = ?").run(id);
  return result.changes > 0;
};
