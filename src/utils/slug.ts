import { findArtistBySlug } from "../db/index.js";

export const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "artist";
};

export const createUniqueArtistSlug = (name: string): string => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 2;

  while (findArtistBySlug(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};
