import fs from "node:fs";
import path from "node:path";

import multer from "multer";

import { env } from "./config/env.js";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
]);

const UPLOAD_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;

const getArtistUploadDir = (artistId: number, section: "banners" | "items"): string => {
  return path.resolve(env.uploadsDir, "artists", artistId.toString(), section);
};

const createSafeFilename = (originalName: string): string => {
  const extension = path.extname(originalName).toLowerCase();
  const uniqueName = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${uniqueName}${extension}`;
};

const storage = multer.diskStorage({
  destination: (request, file, callback) => {
    const artistId = request.session.artistId;

    if (!artistId) {
      callback(new Error("Uploads require a signed-in artist."), "");
      return;
    }

    const section = file.fieldname === "banner" ? "banners" : "items";
    const uploadDir = getArtistUploadDir(artistId, section);
    fs.mkdirSync(uploadDir, { recursive: true });
    callback(null, uploadDir);
  },
  filename: (_request, file, callback) => {
    callback(null, createSafeFilename(file.originalname));
  }
});

export const uploadImages = multer({
  storage,
  limits: {
    fileSize: UPLOAD_SIZE_LIMIT_BYTES,
    files: 12
  },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Only JPEG, PNG, GIF, and WebP images can be uploaded."));
      return;
    }

    callback(null, true);
  }
});

export const storedUploadPath = (file: Express.Multer.File): string => {
  const relativePath = path
    .relative(path.resolve(env.uploadsDir), file.path)
    .split(path.sep)
    .join("/");

  return `/uploads/${relativePath}`;
};

export const deleteStoredUpload = (webPath: string | null | undefined): void => {
  if (!webPath?.startsWith("/uploads/")) {
    return;
  }

  const relativePath = webPath.replace(/^\/uploads\//, "");
  const uploadsRoot = path.resolve(env.uploadsDir);
  const absolutePath = path.resolve(uploadsRoot, relativePath);

  if (absolutePath !== uploadsRoot && !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return;
  }

  try {
    fs.unlinkSync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

export const deleteUploadedFiles = (files: Express.Multer.File[]): void => {
  for (const file of files) {
    deleteStoredUpload(storedUploadPath(file));
  }
};
