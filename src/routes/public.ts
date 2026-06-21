import { Router } from "express";

import {
  findArtistById,
  findArtistBySlug,
  findItemById,
  listArtistsRandomized,
  listItemPhotosByItemId,
  listItemsByArtistId,
  listRandomItems
} from "../db/index.js";
import type { Artist, Item, ItemPhoto } from "../db/index.js";

const router = Router();

interface PublicItemCard extends Item {
  artist: Artist | null;
  primaryPhoto: ItemPhoto | null;
  priceDisplay: string;
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

const toPublicItemCard = (item: Item): PublicItemCard => {
  const photos = listItemPhotosByItemId(item.id);

  return {
    ...item,
    artist: findArtistById(item.artistId),
    primaryPhoto: photos[0] ?? null,
    priceDisplay: formatPrice(item.priceCents, item.currency)
  };
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
  const productId = parseId(request.params.productId);
  const item = productId ? findItemById(productId) : null;
  const artist = item ? findArtistById(item.artistId) : null;

  if (!item || !artist) {
    response.status(404).render("pages/not-found.njk", {
      title: "Product not found"
    });
    return;
  }

  response.render("pages/product.njk", {
    title: item.name,
    item: {
      ...item,
      priceDisplay: formatPrice(item.priceCents, item.currency)
    },
    artist,
    photos: listItemPhotosByItemId(item.id)
  });
});

router.get("/reserve/:itemId", (request, response) => {
  response.render("pages/placeholder.njk", {
    title: "Reserve item",
    heading: "Reserve item",
    detail: `Placeholder for reservation flow: ${request.params.itemId}`
  });
});

export default router;
