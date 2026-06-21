import { getDatabase } from "./database.js";
import type { CreateItemPhotoInput, ItemPhoto } from "./types.js";

interface ItemPhotoRow {
  id: number;
  item_id: number;
  path: string;
  sort_order: number;
  created_at: string;
}

const mapItemPhoto = (row: ItemPhotoRow): ItemPhoto => ({
  id: row.id,
  itemId: row.item_id,
  path: row.path,
  sortOrder: row.sort_order,
  createdAt: row.created_at
});

export const createItemPhoto = (input: CreateItemPhotoInput): ItemPhoto => {
  const result = getDatabase()
    .prepare<[number, string, number]>(
      `
        INSERT INTO item_photos (item_id, path, sort_order)
        VALUES (?, ?, ?)
      `
    )
    .run(input.itemId, input.path, input.sortOrder ?? 0);

  const itemPhoto = findItemPhotoById(Number(result.lastInsertRowid));
  if (!itemPhoto) {
    throw new Error("Failed to load newly created item photo.");
  }

  return itemPhoto;
};

export const findItemPhotoById = (id: number): ItemPhoto | null => {
  const row = getDatabase()
    .prepare<[number], ItemPhotoRow>("SELECT * FROM item_photos WHERE id = ?")
    .get(id);

  return row ? mapItemPhoto(row) : null;
};

export const listItemPhotosByItemId = (itemId: number): ItemPhoto[] => {
  return getDatabase()
    .prepare<[number], ItemPhotoRow>(
      "SELECT * FROM item_photos WHERE item_id = ? ORDER BY sort_order ASC, id ASC"
    )
    .all(itemId)
    .map(mapItemPhoto);
};

export const updateItemPhotoSortOrder = (id: number, sortOrder: number): ItemPhoto | null => {
  getDatabase()
    .prepare<[number, number]>("UPDATE item_photos SET sort_order = ? WHERE id = ?")
    .run(sortOrder, id);

  return findItemPhotoById(id);
};

export const deleteItemPhoto = (id: number): boolean => {
  const result = getDatabase().prepare<[number]>("DELETE FROM item_photos WHERE id = ?").run(id);
  return result.changes > 0;
};

export const deleteItemPhotosByItemId = (itemId: number): number => {
  const result = getDatabase()
    .prepare<[number]>("DELETE FROM item_photos WHERE item_id = ?")
    .run(itemId);

  return result.changes;
};
