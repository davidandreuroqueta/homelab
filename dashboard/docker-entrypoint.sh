#!/bin/sh
set -e

# Run Drizzle migrations on startup if the migrations folder exists
MIGRATIONS="${LINKEDIN_MIGRATIONS_FOLDER:-/app/src/lib/db/migrations}"
DB="${LINKEDIN_DB_PATH:-/app/data/linkedin.db}"

if [ -d "$MIGRATIONS" ]; then
  echo "Running LinkedIn DB migrations from $MIGRATIONS ..."
  node -e "
    const Database = require('better-sqlite3');
    const { drizzle } = require('drizzle-orm/better-sqlite3');
    const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
    const dbPath = process.env.LINKEDIN_DB_PATH || '/app/data/linkedin.db';
    const fs = require('fs');
    const path = require('path');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    const migrationsFolder = process.env.LINKEDIN_MIGRATIONS_FOLDER || '/app/src/lib/db/migrations';
    migrate(db, { migrationsFolder });
    sqlite.close();
    console.log('Migrations applied successfully');
  "
fi

exec "$@"
