import { getDatabase } from "./database.js";
import type {
  CreateReservationInput,
  ListReservationsOptions,
  Reservation,
  ReservationStatus
} from "./types.js";

interface ReservationRow {
  id: number;
  item_id: number;
  artist_id: number;
  customer_telegram: string | null;
  status: ReservationStatus;
  reserved_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
}

const mapReservation = (row: ReservationRow): Reservation => ({
  id: row.id,
  itemId: row.item_id,
  artistId: row.artist_id,
  customerTelegram: row.customer_telegram,
  status: row.status,
  reservedAt: row.reserved_at,
  paidAt: row.paid_at,
  cancelledAt: row.cancelled_at
});

export const createReservation = (input: CreateReservationInput): Reservation => {
  const result = getDatabase()
    .prepare<[number, number, string | null, ReservationStatus]>(
      `
        INSERT INTO reservations (item_id, artist_id, customer_telegram, status)
        VALUES (?, ?, ?, ?)
      `
    )
    .run(
      input.itemId,
      input.artistId,
      input.customerTelegram ?? null,
      input.status ?? "pending"
    );

  const reservation = findReservationById(Number(result.lastInsertRowid));
  if (!reservation) {
    throw new Error("Failed to load newly created reservation.");
  }

  return reservation;
};

export const findReservationById = (id: number): Reservation | null => {
  const row = getDatabase()
    .prepare<[number], ReservationRow>("SELECT * FROM reservations WHERE id = ?")
    .get(id);

  return row ? mapReservation(row) : null;
};

export const listReservations = (options: ListReservationsOptions = {}): Reservation[] => {
  const filters: string[] = [];
  const values: unknown[] = [];

  if (options.artistId !== undefined) {
    filters.push("artist_id = ?");
    values.push(options.artistId);
  }

  if (options.itemId !== undefined) {
    filters.push("item_id = ?");
    values.push(options.itemId);
  }

  if (options.status !== undefined) {
    filters.push("status = ?");
    values.push(options.status);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  return getDatabase()
    .prepare(
      `
        SELECT *
        FROM reservations
        ${whereClause}
        ORDER BY reserved_at DESC, id DESC
      `
    )
    .all(...values)
    .map((row) => mapReservation(row as ReservationRow));
};

export const updateReservationStatus = (
  id: number,
  status: ReservationStatus
): Reservation | null => {
  getDatabase()
    .prepare<[ReservationStatus, ReservationStatus, ReservationStatus, number]>(
      `
        UPDATE reservations
        SET
          status = ?,
          paid_at = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END,
          cancelled_at = CASE WHEN ? = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END
        WHERE id = ?
      `
    )
    .run(status, status, status, id);

  return findReservationById(id);
};

export const deleteReservation = (id: number): boolean => {
  const result = getDatabase().prepare<[number]>("DELETE FROM reservations WHERE id = ?").run(id);
  return result.changes > 0;
};
