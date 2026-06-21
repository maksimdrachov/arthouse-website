export {
  closeDatabase,
  createDatabase,
  getDatabase,
  runInTransaction,
  type SqliteDatabase
} from "./database.js";
export {
  createArtist,
  countArtistsByRole,
  deleteArtist,
  findArtistById,
  findArtistByLoginIdentifier,
  findArtistBySlug,
  listArtists,
  listArtistsRandomized,
  updateArtist
} from "./artists.js";
export {
  createRegistrationCode,
  deleteRegistrationCode,
  findRegistrationCode,
  listRegistrationCodes,
  listUnusedRegistrationCodes,
  markRegistrationCodeUsed
} from "./registration-codes.js";
export {
  createItem,
  deleteItem,
  findItemByArtistAndSlug,
  findItemByArtistSlugAndItemSlug,
  findItemById,
  listItemsByArtistId,
  listItemsByAvailability,
  listRandomItems,
  listSoldItems,
  updateItem,
  updateItemAvailability
} from "./items.js";
export {
  createItemPhoto,
  deleteItemPhoto,
  deleteItemPhotosByItemId,
  findItemPhotoById,
  listItemPhotosByItemId,
  updateItemPhotoSortOrder
} from "./item-photos.js";
export {
  createReservation,
  deleteReservation,
  findReservationById,
  listReservations,
  updateReservationStatus
} from "./reservations.js";
export type {
  Artist,
  ArtistRole,
  CreateArtistInput,
  CreateItemInput,
  CreateItemPhotoInput,
  CreateRegistrationCodeInput,
  CreateReservationInput,
  Item,
  ItemAvailability,
  ItemPhoto,
  ListReservationsOptions,
  RegistrationCode,
  Reservation,
  ReservationStatus,
  UpdateArtistInput,
  UpdateItemInput
} from "./types.js";
