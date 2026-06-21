import "dotenv/config";

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { env } from "../src/config/env.js";

const databasePath = path.resolve(env.databasePath);
const migrationsDir = path.resolve("db/migrations");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((filename) => filename.endsWith(".sql"))
  .sort();

const appliedRows = db
  .prepare("SELECT filename FROM schema_migrations")
  .all() as Array<{ filename: string }>;
const applied = new Set(appliedRows.map((row) => row.filename));
const markApplied = db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)");

for (const filename of migrationFiles) {
  if (applied.has(filename)) {
    console.log(`Skipping ${filename}`);
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
  const applyMigration = db.transaction(() => {
    db.exec(sql);
    markApplied.run(filename);
  });

  applyMigration();
  console.log(`Applied ${filename}`);
}

db.close();
