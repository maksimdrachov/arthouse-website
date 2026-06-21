import { Router } from "express";
import type { Response } from "express";

import {
  createReservation,
  findArtistById,
  findArtistBySlug,
  findItemById,
  findReservationById,
  listArtistsRandomized,
  listItemPhotosByItemId,
  listItemsByArtistId,
  listRandomItems,
  runInTransaction,
  updateItemAvailability
} from "../db/index.js";
import type { Artist, Item, ItemPhoto, Reservation } from "../db/index.js";

const router = Router();

interface PublicItemCard extends Item {
  artist: Artist | null;
  primaryPhoto: ItemPhoto | null;
  priceDisplay: string;
}

interface ReserveFormValues {
  customerTelegram: string;
}

const formatPrice = (priceCents: number, currency: string): string => {
  return `${(priceCents / 100).toFixed(2)} ${currency}`;
};

const parseId = (value: unknown): number | null => {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toTrimmedString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toPublicItemCard = (item: Item): PublicItemCard => {
  const photos = listItemPhotosByItemId(item.id);

  return {
    ...item,
    artist: findArtistById(item.artistId),
    primaryPhoto: photos[0] ?? null,
    priceDisplay: formatPrice(item.priceCents, item.currency)
  };
};

const renderNotFound = (response: Response, title: string): void => {
  response.status(404).render("pages/not-found.njk", {
    title
  });
};

const findProductContext = (
  itemId: number | null
): { item: Item; artist: Artist; photos: ItemPhoto[] } | null => {
  const item = itemId ? findItemById(itemId) : null;
  const artist = item ? findArtistById(item.artistId) : null;

  if (!item || !artist) {
    return null;
  }

  return {
    item,
    artist,
    photos: listItemPhotosByItemId(item.id)
  };
};

const renderReserve = (
  response: Response,
  context: { item: Item; artist: Artist; photos: ItemPhoto[] },
  values: ReserveFormValues,
  errors: string[] = []
): void => {
  response.status(errors.length > 0 ? 400 : 200).render("pages/reserve.njk", {
    title: `Reserve ${context.item.name}`,
    item: {
      ...context.item,
      priceDisplay: formatPrice(context.item.priceCents, context.item.currency)
    },
    artist: context.artist,
    primaryPhoto: context.photos[0] ?? null,
    values,
    errors,
    paymentDescription: context.item.name,
    canReserve: context.item.availability === "available"
  });
};

router.get("/", (_request, response) => {
  response.render("pages/home.njk", {
    title: "ArtHouse",
    items: listRandomItems(36).map(toPublicItemCard),
    artists: listArtistsRandomized()
  });
});

router.get("/artists/:artistSlug", (request, response) => {
  const artistSlug = typeof request.params.artistSlug === "string" ? request.params.artistSlug : "";
  const artist = findArtistBySlug(artistSlug);

  if (!artist) {
    response.status(404).render("pages/not-found.njk", {
      title: "Artist not found"
    });
    return;
  }

  response.render("pages/artist.njk", {
    title: artist.name,
    artist,
    items: listItemsByArtistId(artist.id).map(toPublicItemCard)
  });
});

router.get("/products/:productId", (request, response) => {
  const context = findProductContext(parseId(request.params.productId));

  if (!context) {
    renderNotFound(response, "Product not found");
    return;
  }

  response.render("pages/product.njk", {
    title: context.item.name,
    item: {
      ...context.item,
      priceDisplay: formatPrice(context.item.priceCents, context.item.currency)
    },
    artist: context.artist,
    photos: context.photos
  });
});

router.get("/reserve/:itemId", (request, response) => {
  const context = findProductContext(parseId(request.params.itemId));

  if (!context) {
    renderNotFound(response, "Product not found");
    return;
  }

  renderReserve(response, context, {
    customerTelegram: ""
  });
});

router.post("/reserve/:itemId", (request, response) => {
  const context = findProductContext(parseId(request.params.itemId));

  if (!context) {
    renderNotFound(response, "Product not found");
    return;
  }

  const values: ReserveFormValues = {
    customerTelegram: toTrimmedString(request.body.customerTelegram)
  };
  const errors: string[] = [];

  if (values.customerTelegram.length === 0) {
    errors.push("Telegram contact is required.");
  }

  if (values.customerTelegram.length > 100) {
    errors.push("Telegram contact is too long.");
  }

  if (context.item.availability !== "available") {
    errors.push("This item is no longer available for reservation.");
  }

  if (errors.length > 0) {
    renderReserve(response, context, values, errors);
    return;
  }

  let reservation: Reservation;

  try {
    reservation = runInTransaction(() => {
      const currentItem = findItemById(context.item.id);

      if (!currentItem || currentItem.availability !== "available") {
        throw new Error("This item is no longer available for reservation.");
      }

      const createdReservation = createReservation({
        itemId: currentItem.id,
        artistId: context.artist.id,
        customerTelegram: values.customerTelegram,
        status: "pending"
      });

      updateItemAvailability(currentItem.id, "reserved");

      return createdReservation;
    });
  } catch (error) {
    renderReserve(response, context, values, [(error as Error).message]);
    return;
  }

  response.redirect(`/reserve/${context.item.id}/confirmation/${reservation.id}`);
});

router.get("/reserve/:itemId/confirmation/:reservationId", (request, response) => {
  const context = findProductContext(parseId(request.params.itemId));
  const reservationId = parseId(request.params.reservationId);
  const reservation = reservationId ? findReservationById(reservationId) : null;

  if (!context || !reservation || reservation.itemId !== context.item.id) {
    renderNotFound(response, "Reservation not found");
    return;
  }

  response.render("pages/reservation-confirmation.njk", {
    title: `Reservation for ${context.item.name}`,
    item: {
      ...context.item,
      priceDisplay: formatPrice(context.item.priceCents, context.item.currency)
    },
    artist: context.artist,
    primaryPhoto: context.photos[0] ?? null,
    reservation,
    paymentDescription: context.item.name
  });
});

export default router;
