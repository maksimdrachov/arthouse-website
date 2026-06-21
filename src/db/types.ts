export type ArtistRole = "artist" | "admin";
export type ItemAvailability = "available" | "reserved" | "sold";
export type ReservationStatus = "pending" | "paid" | "cancelled";

export interface Artist {
  id: number;
  slug: string;
  name: string;
  passwordHash: string;
  role: ArtistRole;
  bankAccount: string;
  about: string | null;
  telegram: string | null;
  instagram: string | null;
  bannerPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArtistInput {
  slug: string;
  name: string;
  passwordHash: string;
  role?: ArtistRole;
  bankAccount: string;
  about?: string | null;
  telegram?: string | null;
  instagram?: string | null;
  bannerPath?: string | null;
}

export interface UpdateArtistInput {
  slug?: string;
  name?: string;
  passwordHash?: string;
  role?: ArtistRole;
  bankAccount?: string;
  about?: string | null;
  telegram?: string | null;
  instagram?: string | null;
  bannerPath?: string | null;
}

export interface RegistrationCode {
  code: string;
  createdByArtistId: number | null;
  usedByArtistId: number | null;
  usedAt: string | null;
  createdAt: string;
}

export interface CreateRegistrationCodeInput {
  code: string;
  createdByArtistId?: number | null;
}

export interface Item {
  id: number;
  artistId: number;
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  description: string;
  availability: ItemAvailability;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemInput {
  artistId: number;
  slug: string;
  name: string;
  priceCents: number;
  currency?: string;
  description?: string;
  availability?: ItemAvailability;
}

export interface UpdateItemInput {
  slug?: string;
  name?: string;
  priceCents?: number;
  currency?: string;
  description?: string;
  availability?: ItemAvailability;
}

export interface ItemPhoto {
  id: number;
  itemId: number;
  path: string;
  sortOrder: number;
  createdAt: string;
}

export interface CreateItemPhotoInput {
  itemId: number;
  path: string;
  sortOrder?: number;
}

export interface Reservation {
  id: number;
  itemId: number;
  artistId: number;
  customerTelegram: string | null;
  status: ReservationStatus;
  reservedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
}

export interface CreateReservationInput {
  itemId: number;
  artistId: number;
  customerTelegram?: string | null;
  status?: ReservationStatus;
}

export interface ListReservationsOptions {
  artistId?: number;
  itemId?: number;
  status?: ReservationStatus;
}
