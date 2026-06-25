import { randomInt } from "node:crypto";

import { Router } from "express";
import type { Request, RequestHandler, Response } from "express";

import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { requireAuth, requireRole, signIn, signOut } from "../auth/session.js";
import {
  createArtist,
  createItem,
  createItemPhoto,
  createRegistrationCode,
  deleteArtist,
  deleteItem,
  deleteItemPhoto,
  findArtistById,
  findArtistByLoginIdentifier,
  findItemByArtistAndSlug,
  findItemById,
  findItemPhotoById,
  findRegistrationCode,
  findReservationById,
  listArtists,
  listItemsByAvailability,
  listItemPhotosByItemId,
  listItemsByArtistId,
  listRegistrationCodes,
  listReservations,
  listSoldItems,
  markRegistrationCodeUsed,
  runInTransaction,
  updateArtist,
  updateItem,
  updateReservationStatus
} from "../db/index.js";
import type { Artist, Item, ItemAvailability, ItemPhoto, Reservation } from "../db/index.js";
import {
  ARTIST_BANNER_HEIGHT,
  ARTIST_BANNER_WIDTH,
  deleteStoredUpload,
  deleteUploadedFiles,
  hasRequiredArtistBannerDimensions,
  storedUploadPath,
  uploadImages
} from "../uploads.js";
import { createUniqueArtistSlug, slugify } from "../utils/slug.js";

const router = Router();

const availabilityOptions: ItemAvailability[] = ["available", "reserved", "sold"];

interface RegisterFormValues {
  registrationCode: string;
  artistName: string;
  bankAccount: string;
  about: string;
  telegram: string;
  instagram: string;
}

interface LoginFormValues {
  identifier: string;
  next: string;
}

interface ProfileFormValues {
  name: string;
  bankAccount: string;
  about: string;
  telegram: string;
  instagram: string;
}

interface ItemFormValues {
  name: string;
  price: string;
  currency: string;
  description: string;
  availability: ItemAvailability;
}

interface DashboardItemView extends Item {
  priceDisplay: string;
  primaryPhoto: ItemPhoto | null;
}

interface DashboardReservationView extends Reservation {
  item: Item | null;
}

interface AdminReservationView {
  id: number | null;
  itemId: number;
  artistId: number;
  customerTelegram: string | null;
  status: Reservation["status"] | "reserved";
  reservedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  source: "reservation" | "itemAvailability";
  artist: Artist | null;
  item: Item | null;
  priceDisplay: string;
}

interface AdminSoldItemView extends Item {
  artist: Artist | null;
  priceDisplay: string;
}

interface AdminArtistView extends Artist {
  itemCount: number;
  reservationCount: number;
  soldItemCount: number;
}

const toTrimmedString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toNullableString = (value: string): string | null => {
  return value.length > 0 ? value : null;
};

const normalizeNextPath = (next: string): string => {
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
};

const parseId = (value: unknown): number | null => {
  const parsed = Number.parseInt(toTrimmedString(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isItemAvailability = (value: string): value is ItemAvailability => {
  return availabilityOptions.includes(value as ItemAvailability);
};

const formatPrice = (priceCents: number, currency: string): string => {
  return `${(priceCents / 100).toFixed(2)} ${currency}`;
};

const formatPriceInput = (priceCents: number): string => {
  return (priceCents / 100).toFixed(2);
};

const parsePriceCents = (value: string): number | null => {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  return Math.round(Number.parseFloat(value) * 100);
};

const createSixDigitRegistrationCode = (): string => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    if (!findRegistrationCode(code)) {
      return code;
    }
  }

  throw new Error("Could not generate a unique registration code.");
};

const createUniqueItemSlug = (artistId: number, name: string): string => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 2;

  while (findItemByArtistAndSlug(artistId, slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

const getCurrentArtistOrRedirect = (response: Response): Artist | null => {
  const currentArtist = response.locals.currentArtist;

  if (!currentArtist) {
    response.redirect("/login");
    return null;
  }

  return currentArtist;
};

const getArtistItemOr404 = (response: Response, artistId: number, itemId: number): Item | null => {
  const item = findItemById(itemId);

  if (!item || item.artistId !== artistId) {
    response.status(404).render("pages/not-found.njk", {
      title: "Item not found"
    });
    return null;
  }

  return item;
};

const runUpload = (request: Request, response: Response, middleware: RequestHandler): Promise<void> => {
  return new Promise((resolve, reject) => {
    middleware(request, response, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const uploadedArray = (request: Request): Express.Multer.File[] => {
  if (Array.isArray(request.files)) {
    return request.files;
  }

  if (!request.files) {
    return [];
  }

  return Object.values(request.files).flat();
};

const renderRegister = (
  response: Response,
  values: RegisterFormValues,
  errors: string[] = []
): void => {
  response.status(errors.length > 0 ? 400 : 200).render("pages/register.njk", {
    title: "Artist registration",
    values,
    errors
  });
};

const renderProfileForm = (
  response: Response,
  artist: Artist,
  values: ProfileFormValues,
  errors: string[] = []
): void => {
  response.status(errors.length > 0 ? 400 : 200).render("pages/profile-edit.njk", {
    title: "Edit profile",
    artist,
    values,
    errors
  });
};

const renderItemForm = (
  response: Response,
  options: {
    mode: "new" | "edit";
    item: Item | null;
    photos: ItemPhoto[];
    values: ItemFormValues;
    errors?: string[];
  }
): void => {
  response.status(options.errors?.length ? 400 : 200).render("pages/item-form.njk", {
    title: options.mode === "new" ? "Add item" : "Edit item",
    availabilityOptions,
    ...options,
    errors: options.errors ?? []
  });
};

const buildDashboardItems = (artistId: number): DashboardItemView[] => {
  return listItemsByArtistId(artistId).map((item) => {
    const photos = listItemPhotosByItemId(item.id);

    return {
      ...item,
      priceDisplay: formatPrice(item.priceCents, item.currency),
      primaryPhoto: photos[0] ?? null
    };
  });
};

const buildDashboardReservations = (artistId: number): DashboardReservationView[] => {
  return listReservations({ artistId }).map((reservation) => ({
    ...reservation,
    item: findItemById(reservation.itemId)
  }));
};

const buildAdminReservationReports = (): AdminReservationView[] => {
  const reservations = listReservations().map((reservation) => {
    const item = findItemById(reservation.itemId);
    const artist = findArtistById(reservation.artistId);

    return {
      ...reservation,
      source: "reservation" as const,
      artist,
      item,
      priceDisplay: item ? formatPrice(item.priceCents, item.currency) : ""
    };
  });

  const reservedReservationItemIds = new Set(
    reservations
      .filter((reservation) => reservation.status !== "cancelled")
      .map((reservation) => reservation.itemId)
  );
  const reservedItemsWithoutReservations = listItemsByAvailability("reserved")
    .filter((item) => !reservedReservationItemIds.has(item.id))
    .map((item) => ({
      id: null,
      itemId: item.id,
      artistId: item.artistId,
      customerTelegram: null,
      status: "reserved" as const,
      reservedAt: item.updatedAt,
      paidAt: null,
      cancelledAt: null,
      source: "itemAvailability" as const,
      artist: findArtistById(item.artistId),
      item,
      priceDisplay: formatPrice(item.priceCents, item.currency)
    }));

  return [...reservations, ...reservedItemsWithoutReservations].sort((left, right) => {
    return (
      right.reservedAt.localeCompare(left.reservedAt) ||
      (right.id ?? 0) - (left.id ?? 0) ||
      right.itemId - left.itemId
    );
  });
};

const buildAdminSoldItemReports = (): AdminSoldItemView[] => {
  return listSoldItems().map((item) => ({
    ...item,
    artist: findArtistById(item.artistId),
    priceDisplay: formatPrice(item.priceCents, item.currency)
  }));
};

const buildAdminArtistReports = (): AdminArtistView[] => {
  return listArtists()
    .filter((artist) => artist.role === "artist")
    .map((artist) => {
      const items = listItemsByArtistId(artist.id);
      const reservations = listReservations({ artistId: artist.id });

      return {
        ...artist,
        itemCount: items.length,
        reservationCount: reservations.length,
        soldItemCount: items.filter((item) => item.availability === "sold").length
      };
    });
};

const redirectToAdmin = (response: Response, params: Record<string, string>): void => {
  const query = new URLSearchParams(params).toString();
  response.redirect(`/admin${query ? `?${query}` : ""}`);
};

router.get("/register", (_request, response) => {
  renderRegister(response, {
    registrationCode: "",
    artistName: "",
    bankAccount: "",
    about: "",
    telegram: "",
    instagram: ""
  });
});

router.post("/register", async (request, response) => {
  const values: RegisterFormValues = {
    registrationCode: toTrimmedString(request.body.registrationCode),
    artistName: toTrimmedString(request.body.artistName),
    bankAccount: toTrimmedString(request.body.bankAccount),
    about: toTrimmedString(request.body.about),
    telegram: toTrimmedString(request.body.telegram),
    instagram: toTrimmedString(request.body.instagram)
  };
  const password = toTrimmedString(request.body.password);
  const errors: string[] = [];

  if (!/^\d{6}$/.test(values.registrationCode)) {
    errors.push("Registration code must be a 6-digit number.");
  }

  if (values.artistName.length < 2) {
    errors.push("Artist name is required.");
  }

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }

  if (values.bankAccount.length === 0) {
    errors.push("Bank account is required.");
  }

  if (/^\d{6}$/.test(values.registrationCode)) {
    const registrationCode = findRegistrationCode(values.registrationCode);

    if (!registrationCode) {
      errors.push("Registration code is invalid.");
    } else if (registrationCode.usedAt) {
      errors.push("Registration code has already been used.");
    }
  }

  if (errors.length > 0) {
    renderRegister(response, values, errors);
    return;
  }

  const passwordHash = await hashPassword(password);
  const artist = runInTransaction(() => {
    const createdArtist = createArtist({
      slug: createUniqueArtistSlug(values.artistName),
      name: values.artistName,
      passwordHash,
      role: "artist",
      bankAccount: values.bankAccount,
      about: toNullableString(values.about),
      telegram: toNullableString(values.telegram),
      instagram: toNullableString(values.instagram)
    });

    const usedCode = findRegistrationCode(values.registrationCode);
    if (!usedCode || usedCode.usedAt) {
      throw new Error("Registration code is no longer available.");
    }

    const markedCode = markRegistrationCodeUsed(values.registrationCode, createdArtist.id);
    if (!markedCode || markedCode.usedByArtistId !== createdArtist.id) {
      throw new Error("Registration code could not be marked as used.");
    }

    return createdArtist;
  });

  await signIn(request, artist);
  response.redirect("/dashboard?registered=1");
});

router.get("/login", (request, response) => {
  response.render("pages/login.njk", {
    title: "Login",
    values: {
      identifier: "",
      next: normalizeNextPath(toTrimmedString(request.query.next))
    } satisfies LoginFormValues,
    errors: [],
    registered: request.query.registered === "1",
    loggedOut: request.query.loggedOut === "1"
  });
});

router.post("/login", async (request, response) => {
  const values: LoginFormValues = {
    identifier: toTrimmedString(request.body.identifier),
    next: normalizeNextPath(toTrimmedString(request.body.next))
  };
  const password = toTrimmedString(request.body.password);
  const errors: string[] = [];

  if (values.identifier.length === 0 || password.length === 0) {
    errors.push("Artist/admin name and password are required.");
  }

  const artist = errors.length === 0 ? findArtistByLoginIdentifier(values.identifier) : null;
  const passwordMatches = artist ? await verifyPassword(password, artist.passwordHash) : false;

  if (!artist || !passwordMatches) {
    errors.push("Login details are incorrect.");
  }

  if (errors.length > 0 || !artist) {
    response.status(400).render("pages/login.njk", {
      title: "Login",
      values,
      errors,
      registered: false,
      loggedOut: false
    });
    return;
  }

  await signIn(request, artist);
  response.redirect(artist.role === "admin" && values.next.startsWith("/dashboard") ? "/admin" : values.next);
});

router.post("/logout", requireAuth, async (request, response) => {
  await signOut(request);
  response.clearCookie("arthouse.sid");
  response.redirect("/login?loggedOut=1");
});

router.get("/dashboard", requireRole("artist"), (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  response.render("pages/dashboard.njk", {
    title: "Artist dashboard",
    artist: currentArtist,
    items: buildDashboardItems(currentArtist.id),
    reservations: buildDashboardReservations(currentArtist.id),
    registered: request.query.registered === "1",
    profileUpdated: request.query.profileUpdated === "1",
    itemCreated: request.query.itemCreated === "1",
    itemUpdated: request.query.itemUpdated === "1",
    itemDeleted: request.query.itemDeleted === "1",
    reservationUpdated: request.query.reservationUpdated === "1"
  });
});

router.get("/dashboard/profile/edit", requireRole("artist"), (_request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  renderProfileForm(response, currentArtist, {
    name: currentArtist.name,
    bankAccount: currentArtist.bankAccount,
    about: currentArtist.about ?? "",
    telegram: currentArtist.telegram ?? "",
    instagram: currentArtist.instagram ?? ""
  });
});

router.post("/dashboard/profile", requireRole("artist"), async (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  try {
    await runUpload(request, response, uploadImages.single("banner"));
  } catch (error) {
    renderProfileForm(
      response,
      currentArtist,
      {
        name: toTrimmedString(request.body.name),
        bankAccount: toTrimmedString(request.body.bankAccount),
        about: toTrimmedString(request.body.about),
        telegram: toTrimmedString(request.body.telegram),
        instagram: toTrimmedString(request.body.instagram)
      },
      [(error as Error).message]
    );
    return;
  }

  const uploadedBanner = request.file;
  const values: ProfileFormValues = {
    name: toTrimmedString(request.body.name),
    bankAccount: toTrimmedString(request.body.bankAccount),
    about: toTrimmedString(request.body.about),
    telegram: toTrimmedString(request.body.telegram),
    instagram: toTrimmedString(request.body.instagram)
  };
  const newPassword = toTrimmedString(request.body.password);
  const errors: string[] = [];

  if (values.name.length < 2) {
    errors.push("Artist name is required.");
  }

  if (values.bankAccount.length === 0) {
    errors.push("Bank account is required.");
  }

  if (newPassword.length > 0 && newPassword.length < 8) {
    errors.push("New password must be at least 8 characters.");
  }

  if (uploadedBanner && !hasRequiredArtistBannerDimensions(uploadedBanner)) {
    errors.push(
      `Store banner must be exactly ${ARTIST_BANNER_WIDTH} x ${ARTIST_BANNER_HEIGHT} pixels.`
    );
  }

  if (errors.length > 0) {
    if (uploadedBanner) {
      deleteUploadedFiles([uploadedBanner]);
    }

    renderProfileForm(response, currentArtist, values, errors);
    return;
  }

  const passwordHash = newPassword ? await hashPassword(newPassword) : undefined;
  const bannerPath = uploadedBanner ? storedUploadPath(uploadedBanner) : undefined;

  updateArtist(currentArtist.id, {
    name: values.name,
    bankAccount: values.bankAccount,
    about: toNullableString(values.about),
    telegram: toNullableString(values.telegram),
    instagram: toNullableString(values.instagram),
    passwordHash,
    bannerPath
  });

  if (uploadedBanner && currentArtist.bannerPath) {
    deleteStoredUpload(currentArtist.bannerPath);
  }

  response.redirect("/dashboard?profileUpdated=1");
});

router.get("/dashboard/items/new", requireRole("artist"), (_request, response) => {
  renderItemForm(response, {
    mode: "new",
    item: null,
    photos: [],
    values: {
      name: "",
      price: "",
      currency: "EUR",
      description: "",
      availability: "available"
    }
  });
});

router.post("/dashboard/items", requireRole("artist"), async (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  try {
    await runUpload(request, response, uploadImages.array("photos", 12));
  } catch (error) {
    renderItemForm(response, {
      mode: "new",
      item: null,
      photos: [],
      values: {
        name: toTrimmedString(request.body.name),
        price: toTrimmedString(request.body.price),
        currency: toTrimmedString(request.body.currency) || "EUR",
        description: toTrimmedString(request.body.description),
        availability: "available"
      },
      errors: [(error as Error).message]
    });
    return;
  }

  const uploadedPhotos = uploadedArray(request);
  const availability = toTrimmedString(request.body.availability);
  const values: ItemFormValues = {
    name: toTrimmedString(request.body.name),
    price: toTrimmedString(request.body.price),
    currency: (toTrimmedString(request.body.currency) || "EUR").toUpperCase(),
    description: toTrimmedString(request.body.description),
    availability: isItemAvailability(availability) ? availability : "available"
  };
  const priceCents = parsePriceCents(values.price);
  const errors: string[] = [];

  if (values.name.length === 0) {
    errors.push("Item name is required.");
  }

  if (priceCents === null) {
    errors.push("Price must be a number with up to two decimal places.");
  }

  if (!/^[A-Z]{3}$/.test(values.currency)) {
    errors.push("Currency must be a 3-letter code.");
  }

  if (!isItemAvailability(availability)) {
    errors.push("Availability is invalid.");
  }

  if (errors.length > 0 || priceCents === null) {
    deleteUploadedFiles(uploadedPhotos);
    renderItemForm(response, {
      mode: "new",
      item: null,
      photos: [],
      values,
      errors
    });
    return;
  }

  try {
    runInTransaction(() => {
      const item = createItem({
        artistId: currentArtist.id,
        slug: createUniqueItemSlug(currentArtist.id, values.name),
        name: values.name,
        priceCents,
        currency: values.currency,
        description: values.description,
        availability: values.availability
      });

      uploadedPhotos.forEach((photo, index) => {
        createItemPhoto({
          itemId: item.id,
          path: storedUploadPath(photo),
          sortOrder: index
        });
      });
    });
  } catch (error) {
    deleteUploadedFiles(uploadedPhotos);
    throw error;
  }

  response.redirect("/dashboard?itemCreated=1");
});

router.get("/dashboard/items/:itemId/edit", requireRole("artist"), (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  const itemId = parseId(request.params.itemId);
  const item = itemId ? getArtistItemOr404(response, currentArtist.id, itemId) : null;
  if (!item) {
    return;
  }

  renderItemForm(response, {
    mode: "edit",
    item,
    photos: listItemPhotosByItemId(item.id),
    values: {
      name: item.name,
      price: formatPriceInput(item.priceCents),
      currency: item.currency,
      description: item.description,
      availability: item.availability
    }
  });
});

router.post("/dashboard/items/:itemId", requireRole("artist"), async (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  const itemId = parseId(request.params.itemId);
  const item = itemId ? getArtistItemOr404(response, currentArtist.id, itemId) : null;
  if (!item) {
    return;
  }

  try {
    await runUpload(request, response, uploadImages.array("photos", 12));
  } catch (error) {
    renderItemForm(response, {
      mode: "edit",
      item,
      photos: listItemPhotosByItemId(item.id),
      values: {
        name: toTrimmedString(request.body.name),
        price: toTrimmedString(request.body.price),
        currency: toTrimmedString(request.body.currency) || "EUR",
        description: toTrimmedString(request.body.description),
        availability: item.availability
      },
      errors: [(error as Error).message]
    });
    return;
  }

  const uploadedPhotos = uploadedArray(request);
  const availability = toTrimmedString(request.body.availability);
  const values: ItemFormValues = {
    name: toTrimmedString(request.body.name),
    price: toTrimmedString(request.body.price),
    currency: (toTrimmedString(request.body.currency) || "EUR").toUpperCase(),
    description: toTrimmedString(request.body.description),
    availability: isItemAvailability(availability) ? availability : item.availability
  };
  const priceCents = parsePriceCents(values.price);
  const errors: string[] = [];

  if (values.name.length === 0) {
    errors.push("Item name is required.");
  }

  if (priceCents === null) {
    errors.push("Price must be a number with up to two decimal places.");
  }

  if (!/^[A-Z]{3}$/.test(values.currency)) {
    errors.push("Currency must be a 3-letter code.");
  }

  if (!isItemAvailability(availability)) {
    errors.push("Availability is invalid.");
  }

  if (errors.length > 0 || priceCents === null) {
    deleteUploadedFiles(uploadedPhotos);
    renderItemForm(response, {
      mode: "edit",
      item,
      photos: listItemPhotosByItemId(item.id),
      values,
      errors
    });
    return;
  }

  try {
    runInTransaction(() => {
      updateItem(item.id, {
        name: values.name,
        priceCents,
        currency: values.currency,
        description: values.description,
        availability: values.availability
      });

      const existingPhotoCount = listItemPhotosByItemId(item.id).length;
      uploadedPhotos.forEach((photo, index) => {
        createItemPhoto({
          itemId: item.id,
          path: storedUploadPath(photo),
          sortOrder: existingPhotoCount + index
        });
      });
    });
  } catch (error) {
    deleteUploadedFiles(uploadedPhotos);
    throw error;
  }

  response.redirect("/dashboard?itemUpdated=1");
});

router.post("/dashboard/items/:itemId/availability", requireRole("artist"), (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  const itemId = parseId(request.params.itemId);
  const item = itemId ? getArtistItemOr404(response, currentArtist.id, itemId) : null;
  if (!item) {
    return;
  }

  const availability = toTrimmedString(request.body.availability);
  if (isItemAvailability(availability)) {
    updateItem(item.id, { availability });
  }

  response.redirect("/dashboard?itemUpdated=1");
});

router.post("/dashboard/reservations/:reservationId/status", requireRole("artist"), (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  const reservationId = parseId(request.params.reservationId);
  const reservation = reservationId ? findReservationById(reservationId) : null;

  if (!reservation || reservation.artistId !== currentArtist.id) {
    response.status(404).render("pages/not-found.njk", {
      title: "Reservation not found"
    });
    return;
  }

  const status = toTrimmedString(request.body.status);
  if (status !== "paid" && status !== "cancelled") {
    response.redirect("/dashboard");
    return;
  }

  if (reservation.status !== "pending") {
    response.redirect("/dashboard");
    return;
  }

  runInTransaction(() => {
    updateReservationStatus(reservation.id, status);

    const item = findItemById(reservation.itemId);
    if (!item || item.artistId !== currentArtist.id) {
      return;
    }

    if (status === "paid") {
      updateItem(item.id, { availability: "sold" });
    } else if (
      item.availability === "reserved" &&
      !listReservations({ itemId: item.id }).some((currentReservation) => currentReservation.status !== "cancelled")
    ) {
      updateItem(item.id, { availability: "available" });
    }
  });

  response.redirect("/dashboard?reservationUpdated=1");
});

router.post("/dashboard/items/:itemId/photos/:photoId/delete", requireRole("artist"), (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  const itemId = parseId(request.params.itemId);
  const photoId = parseId(request.params.photoId);
  const item = itemId ? getArtistItemOr404(response, currentArtist.id, itemId) : null;
  const photo = photoId ? findItemPhotoById(photoId) : null;

  if (!item || !photo || photo.itemId !== item.id) {
    response.status(404).render("pages/not-found.njk", {
      title: "Photo not found"
    });
    return;
  }

  deleteItemPhoto(photo.id);
  deleteStoredUpload(photo.path);
  response.redirect(`/dashboard/items/${item.id}/edit`);
});

router.post("/dashboard/items/:itemId/delete", requireRole("artist"), (request, response) => {
  const currentArtist = getCurrentArtistOrRedirect(response);
  if (!currentArtist) {
    return;
  }

  const itemId = parseId(request.params.itemId);
  const item = itemId ? getArtistItemOr404(response, currentArtist.id, itemId) : null;
  if (!item) {
    return;
  }

  const photos = listItemPhotosByItemId(item.id);
  deleteItem(item.id);
  photos.forEach((photo) => deleteStoredUpload(photo.path));
  response.redirect("/dashboard?itemDeleted=1");
});

router.get("/admin", requireRole("admin"), (request, response) => {
  response.render("pages/admin.njk", {
    title: "Admin",
    artist: response.locals.currentArtist,
    registrationCodes: listRegistrationCodes(),
    reservations: buildAdminReservationReports(),
    soldItems: buildAdminSoldItemReports(),
    artists: buildAdminArtistReports(),
    generatedCode: toTrimmedString(request.query.generatedCode),
    artistRemoved: request.query.artistRemoved === "1",
    artistRemoveError: toTrimmedString(request.query.artistRemoveError)
  });
});

router.post("/admin/registration-codes", requireRole("admin"), (_request, response) => {
  const currentArtist = response.locals.currentArtist as Artist;
  const registrationCode = createRegistrationCode({
    code: createSixDigitRegistrationCode(),
    createdByArtistId: currentArtist.id
  });

  redirectToAdmin(response, { generatedCode: registrationCode.code });
});

router.post("/admin/artists/:artistId/delete", requireRole("admin"), (request, response) => {
  const artistId = parseId(request.params.artistId);
  const artist = artistId ? findArtistById(artistId) : null;

  if (!artist) {
    redirectToAdmin(response, { artistRemoveError: "Artist account not found." });
    return;
  }

  if (artist.role !== "artist") {
    redirectToAdmin(response, { artistRemoveError: "Only artist accounts can be removed." });
    return;
  }

  const itemPhotoPaths = listItemsByArtistId(artist.id).flatMap((item) =>
    listItemPhotosByItemId(item.id).map((photo) => photo.path)
  );
  const uploadPaths = [artist.bannerPath, ...itemPhotoPaths];

  const removed = deleteArtist(artist.id);
  if (!removed) {
    redirectToAdmin(response, { artistRemoveError: "Artist account could not be removed." });
    return;
  }

  uploadPaths.forEach((path) => deleteStoredUpload(path));
  redirectToAdmin(response, { artistRemoved: "1" });
});

export default router;
