import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
  closeDatabase,
  createArtist,
  createItem,
  createItemPhoto,
  findArtistBySlug,
  findItemByArtistAndSlug,
  listItemPhotosByItemId,
  runInTransaction,
  updateArtist,
  updateItem
} from "../src/db/index.js";

interface DemoArtist {
  slug: string;
  name: string;
  bannerPath: string;
  about: string;
  telegram: string;
  instagram: string;
  bankAccount: string;
}

interface DemoItemGroup {
  slug: string;
  name: string;
  photoPaths: string[];
}

const seed = process.env.DEMO_SEED?.trim() || "arthouse-demo";
const demoPasswordHash = "demo-public-asset-account";
const availabilityCycle = ["available", "available", "available", "reserved", "sold"] as const;

const titleize = (slug: string): string => {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const seededNumber = (value: string): number => {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const seededShuffle = <T>(values: T[]): T[] => {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = seededNumber(`${seed}:${index}`) % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

const getDemoArtists = (): DemoArtist[] => {
  const bannerDir = path.resolve("assets/banners");
  const bannerFiles = fs
    .readdirSync(bannerDir)
    .filter((filename) => filename.endsWith(".png"))
    .sort();

  return bannerFiles.map((filename, index) => {
    const slug = filename.replace(/\.png$/, "");
    const name = titleize(slug);

    return {
      slug,
      name,
      bannerPath: `/assets/banners/${filename}`,
      about: `${name} is part of the ArtHouse collective.`,
      telegram: `@${slug.replace(/-/g, "")}`,
      instagram: slug.replace(/-/g, "."),
      bankAccount: `DEMO-ARTIST-${String(index + 1).padStart(2, "0")}`
    };
  });
};

const getDemoItemGroups = (): DemoItemGroup[] => {
  const itemDir = path.resolve("assets/items");
  const groups = new Map<string, string[]>();

  for (const filename of fs.readdirSync(itemDir).filter((file) => file.endsWith(".png"))) {
    const match = filename.match(/^(.*)-(\d+)\.png$/);
    if (!match) {
      continue;
    }

    const slug = match[1];
    const photoPaths = groups.get(slug) ?? [];
    photoPaths.push(`/assets/items/${filename}`);
    groups.set(slug, photoPaths);
  }

  return [...groups.entries()]
    .sort(([firstSlug], [secondSlug]) => firstSlug.localeCompare(secondSlug))
    .map(([slug, photoPaths]) => ({
      slug,
      name: titleize(slug),
      photoPaths: photoPaths.sort((first, second) =>
        first.localeCompare(second, undefined, { numeric: true })
      )
    }));
};

const priceForSlug = (slug: string): number => {
  return 1800 + (seededNumber(`price:${slug}`) % 15_000);
};

const descriptionFor = (artistName: string, itemName: string): string => {
  return `${itemName} from ${artistName}. A demo catalog piece seeded from the checked-in ArtHouse asset set.`;
};

const artists = getDemoArtists();
const itemGroups = seededShuffle(getDemoItemGroups());

runInTransaction(() => {
  const artistIds = artists.map((demoArtist) => {
    const existingArtist = findArtistBySlug(demoArtist.slug);

    if (existingArtist) {
      updateArtist(existingArtist.id, {
        name: demoArtist.name,
        role: "artist",
        bankAccount: demoArtist.bankAccount,
        about: demoArtist.about,
        telegram: demoArtist.telegram,
        instagram: demoArtist.instagram,
        bannerPath: demoArtist.bannerPath
      });

      return existingArtist.id;
    }

    return createArtist({
      slug: demoArtist.slug,
      name: demoArtist.name,
      passwordHash: demoPasswordHash,
      role: "artist",
      bankAccount: demoArtist.bankAccount,
      about: demoArtist.about,
      telegram: demoArtist.telegram,
      instagram: demoArtist.instagram,
      bannerPath: demoArtist.bannerPath
    }).id;
  });

  itemGroups.forEach((itemGroup, index) => {
    const artistIndex = index % artistIds.length;
    const artistId = artistIds[artistIndex];
    const demoArtist = artists[artistIndex];
    const availability = availabilityCycle[index % availabilityCycle.length];
    const existingItem = findItemByArtistAndSlug(artistId, itemGroup.slug);

    const item = existingItem
      ? updateItem(existingItem.id, {
          name: itemGroup.name,
          priceCents: priceForSlug(itemGroup.slug),
          currency: "EUR",
          description: descriptionFor(demoArtist.name, itemGroup.name),
          availability
        })
      : createItem({
          artistId,
          slug: itemGroup.slug,
          name: itemGroup.name,
          priceCents: priceForSlug(itemGroup.slug),
          currency: "EUR",
          description: descriptionFor(demoArtist.name, itemGroup.name),
          availability
        });

    if (!item) {
      throw new Error(`Could not create or update item: ${itemGroup.slug}`);
    }

    const existingPhotoPaths = new Set(listItemPhotosByItemId(item.id).map((photo) => photo.path));

    itemGroup.photoPaths.forEach((photoPath, photoIndex) => {
      if (existingPhotoPaths.has(photoPath)) {
        return;
      }

      createItemPhoto({
        itemId: item.id,
        path: photoPath,
        sortOrder: photoIndex
      });
    });
  });
});

console.log(`Seeded ${artists.length} demo artists and ${itemGroups.length} asset-backed items.`);
console.log(`Demo seed: ${seed}`);

closeDatabase();
