import { Router } from "express";
import type { Response } from "express";

import {
  createReservation,
  findArtistById,
  findItemById,
  findReservationById,
  findStoreArtistBySlug,
  listStoreArtistsWithItemsRandomized,
  listItemPhotosByItemId,
  listItemsByArtistId,
  listRandomItems,
  runInTransaction,
  updateItemAvailability
} from "../db/index.js";
import type { Artist, Item, ItemPhoto, Reservation } from "../db/index.js";

const router = Router();
const HOME_INITIAL_ITEM_COUNT = 18;
const HOME_LOAD_MORE_ITEM_COUNT = 12;

interface PublicItemCard extends Item {
  artist: Artist | null;
  primaryPhoto: ItemPhoto | null;
  priceDisplay: string;
}

interface PublicItemCardResponse {
  id: number;
  href: string;
  name: string;
  artistName: string | null;
  priceDisplay: string;
  primaryPhotoPath: string | null;
}

interface PublicArtistProfile extends Artist {
  telegramUrl: string | null;
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

const parseItemIds = (value: unknown): number[] => {
  const rawValues = Array.isArray(value) ? value : [value];
  const itemIds = new Set<number>();

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") {
      continue;
    }

    for (const part of rawValue.split(",")) {
      const parsed = Number.parseInt(part, 10);

      if (Number.isInteger(parsed) && parsed > 0) {
        itemIds.add(parsed);
      }
    }
  }

  return [...itemIds].slice(0, 500);
};

const toTrimmedString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const telegramHandlePattern = /^[a-zA-Z0-9_]{5,32}$/;

const toTelegramUrl = (value: string | null): string | null => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  const directLinkMatch = trimmedValue.match(
    /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(@?[a-zA-Z0-9_]{5,32})\/?$/i
  );

  if (directLinkMatch) {
    return `https://t.me/${directLinkMatch[1].replace(/^@/, "")}`;
  }

  const handle = trimmedValue.replace(/^@/, "");

  if (!telegramHandlePattern.test(handle)) {
    return null;
  }

  return `https://t.me/${handle}`;
};

const toPublicArtistProfile = (artist: Artist): PublicArtistProfile => {
  return {
    ...artist,
    telegramUrl: toTelegramUrl(artist.telegram)
  };
};

const toPublicItemCard = (item: Item): PublicItemCard => {
  const photos = listItemPhotosByItemId(item.id);
  const artist = findArtistById(item.artistId);

  return {
    ...item,
    artist: artist?.role === "artist" ? artist : null,
    primaryPhoto: photos[0] ?? null,
    priceDisplay: formatPrice(item.priceCents, item.currency)
  };
};

const toPublicItemCardResponse = (item: PublicItemCard): PublicItemCardResponse => {
  return {
    id: item.id,
    href: `/products/${item.id}`,
    name: item.name,
    artistName: item.artist?.name ?? null,
    priceDisplay: item.priceDisplay,
    primaryPhotoPath: item.primaryPhoto?.path ?? null
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

  if (!item || !artist || artist.role !== "artist") {
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
  const items = listRandomItems(HOME_INITIAL_ITEM_COUNT + 1);

  response.render("pages/home.njk", {
    title: "ArtHouse",
    items: items.slice(0, HOME_INITIAL_ITEM_COUNT).map(toPublicItemCard),
    hasMoreItems: items.length > HOME_INITIAL_ITEM_COUNT,
    artists: listStoreArtistsWithItemsRandomized()
  });
});

router.get("/api/home-items", (request, response) => {
  const excludedItemIds = parseItemIds(request.query.exclude);
  const items = listRandomItems(HOME_LOAD_MORE_ITEM_COUNT + 1, excludedItemIds).map(
    toPublicItemCard
  );

  response.json({
    items: items.slice(0, HOME_LOAD_MORE_ITEM_COUNT).map(toPublicItemCardResponse),
    hasMoreItems: items.length > HOME_LOAD_MORE_ITEM_COUNT
  });
});

router.get("/artists/:artistSlug", (request, response) => {
  const artistSlug = typeof request.params.artistSlug === "string" ? request.params.artistSlug : "";
  const artist = findStoreArtistBySlug(artistSlug);

  if (!artist) {
    response.status(404).render("pages/not-found.njk", {
      title: "Artist not found"
    });
    return;
  }

  response.render("pages/artist.njk", {
    title: artist.name,
    artist: toPublicArtistProfile(artist),
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
