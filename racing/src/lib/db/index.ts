/**
 * Local SQLite store for vehicles, sessions, and community-shared diagnoses.
 * Keep the schema minimal — most state lives in the browser (zustand).
 *
 * This module only loads better-sqlite3 at runtime on the server, so it never
 * gets bundled for the client.
 */

import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "racing.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin TEXT UNIQUE,
      label TEXT,
      make TEXT,
      model TEXT,
      year INTEGER,
      engine TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shared_diagnoses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin_hash TEXT,             -- sha256 of VIN, never the raw VIN
      make TEXT,
      model TEXT,
      year INTEGER,
      engine TEXT,
      dtcs_json TEXT NOT NULL,
      freeze_frame_json TEXT,
      diagnosis_md TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shared_make_model
      ON shared_diagnoses(make, model);
  `);
}
