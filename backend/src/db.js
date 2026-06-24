import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'app.sqlite');

mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export function getEntry(key) {
  return db.prepare('SELECT key, value, created_at, updated_at FROM entries WHERE key = ?').get(key);
}

export function listEntries() {
  return db.prepare('SELECT key, value, created_at, updated_at FROM entries ORDER BY key').all();
}

export function upsertEntry(key, value) {
  return db
    .prepare(
      `
        INSERT INTO entries (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `
    )
    .run(key, value);
}

export function deleteEntry(key) {
  return db.prepare('DELETE FROM entries WHERE key = ?').run(key);
}
