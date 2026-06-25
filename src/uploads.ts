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
export const ARTIST_BANNER_WIDTH = 1100;
export const ARTIST_BANNER_HEIGHT = 250;

interface ImageDimensions {
  width: number;
  height: number;
}

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

const readThreeByteLittleEndian = (buffer: Buffer, offset: number): number => {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
};

const readPngDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (
    buffer.length < 24 ||
    buffer.readUInt32BE(0) !== 0x89504e47 ||
    buffer.readUInt32BE(4) !== 0x0d0a1a0a ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

const readGifDimensions = (buffer: Buffer): ImageDimensions | null => {
  const header = buffer.subarray(0, 6).toString("ascii");

  if (buffer.length < 10 || (header !== "GIF87a" && header !== "GIF89a")) {
    return null;
  }

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  };
};

const readJpegDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf
  ]);

  while (offset < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) {
      offset += 1;
    }

    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= buffer.length) {
      return null;
    }

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }

    if (offset + 2 > buffer.length) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset);

    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return null;
    }

    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) {
        return null;
      }

      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }

    offset += segmentLength;
  }

  return null;
};

const readWebpDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkStart + chunkSize > buffer.length) {
      return null;
    }

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: readThreeByteLittleEndian(buffer, chunkStart + 4) + 1,
        height: readThreeByteLittleEndian(buffer, chunkStart + 7) + 1
      };
    }

    if (chunkType === "VP8 " && chunkSize >= 10) {
      if (
        buffer[chunkStart + 3] !== 0x9d ||
        buffer[chunkStart + 4] !== 0x01 ||
        buffer[chunkStart + 5] !== 0x2a
      ) {
        return null;
      }

      return {
        width: buffer.readUInt16LE(chunkStart + 6) & 0x3fff,
        height: buffer.readUInt16LE(chunkStart + 8) & 0x3fff
      };
    }

    if (chunkType === "VP8L" && chunkSize >= 5) {
      if (buffer[chunkStart] !== 0x2f) {
        return null;
      }

      const byte1 = buffer[chunkStart + 1];
      const byte2 = buffer[chunkStart + 2];
      const byte3 = buffer[chunkStart + 3];
      const byte4 = buffer[chunkStart + 4];

      return {
        width: 1 + (((byte2 & 0x3f) << 8) | byte1),
        height: 1 + (((byte4 & 0x0f) << 10) | (byte3 << 2) | ((byte2 & 0xc0) >> 6))
      };
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  return null;
};

export const readImageDimensions = (filePath: string): ImageDimensions | null => {
  const buffer = fs.readFileSync(filePath);

  return (
    readPngDimensions(buffer) ??
    readGifDimensions(buffer) ??
    readJpegDimensions(buffer) ??
    readWebpDimensions(buffer)
  );
};

export const hasRequiredArtistBannerDimensions = (file: Express.Multer.File): boolean => {
  const dimensions = readImageDimensions(file.path);

  return dimensions?.width === ARTIST_BANNER_WIDTH && dimensions.height === ARTIST_BANNER_HEIGHT;
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
