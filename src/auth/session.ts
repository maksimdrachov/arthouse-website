import type { NextFunction, Request, Response } from "express";
import type { SessionData } from "express-session";

import { findArtistById } from "../db/index.js";
import type { Artist, ArtistRole } from "../db/index.js";

declare module "express-session" {
  interface SessionData {
    artistId?: number;
    role?: ArtistRole;
  }
}

declare global {
  namespace Express {
    interface Locals {
      currentArtist: Artist | null;
      isAuthenticated: boolean;
      isAdmin: boolean;
    }
  }
}

export const loadCurrentArtist = (
  request: Request,
  response: Response,
  next: NextFunction
): void => {
  const artistId = request.session.artistId;
  const currentArtist = artistId ? findArtistById(artistId) : null;

  if (!currentArtist && artistId) {
    request.session.artistId = undefined;
    request.session.role = undefined;
  }

  response.locals.currentArtist = currentArtist;
  response.locals.isAuthenticated = Boolean(currentArtist);
  response.locals.isAdmin = currentArtist?.role === "admin";

  next();
};

export const getCurrentArtist = (request: Request): Artist | null => {
  const artistId = request.session.artistId;
  return artistId ? findArtistById(artistId) : null;
};

export const signIn = (request: Request, artist: Artist): Promise<void> => {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      request.session.artistId = artist.id;
      request.session.role = artist.role;

      request.session.save((saveError) => {
        if (saveError) {
          reject(saveError);
          return;
        }

        resolve();
      });
    });
  });
};

export const signOut = (request: Request): Promise<void> => {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

export const requireAuth = (
  request: Request,
  response: Response,
  next: NextFunction
): void => {
  if (response.locals.currentArtist) {
    next();
    return;
  }

  response.redirect(`/login?next=${encodeURIComponent(request.originalUrl)}`);
};

export const requireRole = (role: ArtistRole) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    const currentArtist = response.locals.currentArtist;

    if (!currentArtist) {
      response.redirect(`/login?next=${encodeURIComponent(request.originalUrl)}`);
      return;
    }

    if (currentArtist.role !== role) {
      response.status(403).render("pages/forbidden.njk", {
        title: "Forbidden"
      });
      return;
    }

    next();
  };
};

export const copySessionUser = (session: SessionData, artist: Artist): void => {
  session.artistId = artist.id;
  session.role = artist.role;
};
