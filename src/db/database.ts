import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { env } from "../config/env.js";

export type SqliteDatabase = Database.Database;

let database: SqliteDatabase | null = null;

const resolveDatabasePath = (databasePath: string): string => {
  if (databasePath === ":memory:") {
    return databasePath;
  }

  return path.resolve(databasePath);
};

export const createDatabase = (databasePath = env.databasePath): SqliteDatabase => {
  const resolvedPath = resolveDatabasePath(databasePath);

  if (resolvedPath !== ":memory:") {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma("foreign_keys = ON");

  return db;
};

export const getDatabase = (): SqliteDatabase => {
  database ??= createDatabase();
  return database;
};

export const closeDatabase = (): void => {
  if (!database) {
    return;
  }

  database.close();
  database = null;
};

export const runInTransaction = <T>(callback: () => T): T => {
  return getDatabase().transaction(callback)();
};
