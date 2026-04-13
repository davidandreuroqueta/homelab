import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate';

describe('runMigrations', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-db-'));
    dbPath = path.join(tmpDir, 'test.db');
    process.env.LINKEDIN_DB_PATH = dbPath;
    process.env.LINKEDIN_MIGRATIONS_FOLDER = path.resolve(__dirname, 'migrations');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.LINKEDIN_DB_PATH;
    delete process.env.LINKEDIN_MIGRATIONS_FOLDER;
  });

  it('creates all tables on a fresh DB', () => {
    runMigrations();
    const db = new Database(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain('drafts');
    expect(names).toContain('published');
    expect(names).toContain('chat_messages');
    expect(names).toContain('sources');
    expect(names).toContain('episodes');
    expect(names).toContain('generation_runs');
    expect(names).toContain('voice_profile_updates');
    db.close();
  });
});
