import "dotenv/config";

import { hashPassword } from "../src/auth/passwords.js";
import {
  closeDatabase,
  countArtistsByRole,
  createArtist,
  findArtistBySlug,
  updateArtist
} from "../src/db/index.js";
import { slugify } from "../src/utils/slug.js";

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const adminName = process.env.ADMIN_NAME?.trim() || "Admin";
const adminSlug = slugify(process.env.ADMIN_SLUG?.trim() || adminName);
const adminPassword = requireEnv("ADMIN_PASSWORD");
const adminBankAccount = process.env.ADMIN_BANK_ACCOUNT?.trim() || "ADMIN-BANK-ACCOUNT";
const passwordHash = await hashPassword(adminPassword);
const existingAdmin = findArtistBySlug(adminSlug);
const existingAdminCount = countArtistsByRole("admin");

if (existingAdmin) {
  updateArtist(existingAdmin.id, {
    name: adminName,
    passwordHash,
    role: "admin",
    bankAccount: adminBankAccount
  });
  console.log(`Updated admin account: ${adminSlug}`);
} else {
  createArtist({
    slug: adminSlug,
    name: adminName,
    passwordHash,
    role: "admin",
    bankAccount: adminBankAccount
  });
  console.log(`Created admin account: ${adminSlug}`);
}

if (existingAdminCount > 0 && !existingAdmin) {
  console.log("An admin account already existed; this script added another admin.");
}

closeDatabase();
