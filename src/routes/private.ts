import { randomInt } from "node:crypto";

import { Router } from "express";
import type { Response } from "express";

import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { getCurrentArtist, requireAuth, requireRole, signIn, signOut } from "../auth/session.js";
import {
  createArtist,
  createRegistrationCode,
  findArtistByLoginIdentifier,
  findRegistrationCode,
  listRegistrationCodes,
  markRegistrationCodeUsed,
  runInTransaction
} from "../db/index.js";
import type { Artist } from "../db/index.js";
import { createUniqueArtistSlug } from "../utils/slug.js";

const router = Router();

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

const createSixDigitRegistrationCode = (): string => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    if (!findRegistrationCode(code)) {
      return code;
    }
  }

  throw new Error("Could not generate a unique registration code.");
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
  response.redirect(values.next);
});

router.post("/logout", requireAuth, async (request, response) => {
  await signOut(request);
  response.clearCookie("arthouse.sid");
  response.redirect("/login?loggedOut=1");
});

router.get("/dashboard", requireAuth, (_request, response) => {
  const currentArtist = response.locals.currentArtist;

  if (!currentArtist) {
    response.redirect("/login");
    return;
  }

  response.render("pages/dashboard.njk", {
    title: "Artist dashboard",
    artist: currentArtist,
    registered: _request.query.registered === "1"
  });
});

router.get("/admin", requireRole("admin"), (request, response) => {
  response.render("pages/admin.njk", {
    title: "Admin",
    artist: response.locals.currentArtist,
    registrationCodes: listRegistrationCodes(),
    generatedCode: toTrimmedString(request.query.generatedCode)
  });
});

router.post("/admin/registration-codes", requireRole("admin"), (_request, response) => {
  const currentArtist = response.locals.currentArtist as Artist;
  const registrationCode = createRegistrationCode({
    code: createSixDigitRegistrationCode(),
    createdByArtistId: currentArtist.id
  });

  response.redirect(`/admin?generatedCode=${encodeURIComponent(registrationCode.code)}`);
});

export default router;
