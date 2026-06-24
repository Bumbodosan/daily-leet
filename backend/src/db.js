import { mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS magic_links (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS magic_links_user_id_idx ON magic_links(user_id);

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
`);

function randomId() {
  return crypto.randomUUID();
}

export function createUserForEmail(email) {
  db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)').run(randomId(), email);
  return db.prepare('SELECT id, email, created_at FROM users WHERE email = ?').get(email);
}

export function findUserById(id) {
  return db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(id);
}

export function createMagicLink(userId, tokenHash, expiresAt) {
  return db
    .prepare('INSERT INTO magic_links (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt);
}

export function getMagicLinkByHash(tokenHash) {
  return db
    .prepare(
      `
        SELECT token_hash, user_id, expires_at, used_at, created_at
        FROM magic_links
        WHERE token_hash = ?
      `
    )
    .get(tokenHash);
}

export function markMagicLinkUsed(tokenHash) {
  return db
    .prepare('UPDATE magic_links SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ?')
    .run(tokenHash);
}

export function createSession(userId, tokenHash, expiresAt) {
  return db
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt);
}

export function findSessionByHash(tokenHash) {
  return db
    .prepare(
      `
        SELECT token_hash, user_id, expires_at, created_at
        FROM sessions
        WHERE token_hash = ?
      `
    )
    .get(tokenHash);
}

export function deleteSession(tokenHash) {
  return db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

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
