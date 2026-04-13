import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import fs from 'node:fs';

export function runMigrations() {
  const dbPath = process.env.LINKEDIN_DB_PATH ?? path.resolve('./data/linkedin.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  const migrationsFolder = process.env.LINKEDIN_MIGRATIONS_FOLDER ?? path.resolve('./src/lib/db/migrations');
  migrate(db, { migrationsFolder });
  sqlite.close();
}

if (require.main === module) {
  runMigrations();
  console.log('migrations applied');
}
