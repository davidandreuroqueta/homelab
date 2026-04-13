import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'node:path';
import fs from 'node:fs';

let _db: BetterSQLite3Database<typeof schema> | null = null;

export function getDb() {
  if (_db) return _db;
  const dbPath = process.env.LINKEDIN_DB_PATH ?? path.resolve('./data/linkedin.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  _db = drizzle(sqlite, { schema });
  return _db;
}

export function resetDb() {
  _db = null;
}

export { schema };
