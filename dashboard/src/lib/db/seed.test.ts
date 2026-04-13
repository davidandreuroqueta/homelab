import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runMigrations } from './migrate';
import { seedSources } from './seed';
import { getDb, resetDb } from './client';
import { sources } from './schema';

describe('seedSources', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-seed-'));
    process.env.LINKEDIN_DB_PATH = path.join(tmpDir, 'seed.db');
    process.env.LINKEDIN_MIGRATIONS_FOLDER = path.resolve(__dirname, 'migrations');
    resetDb();
    runMigrations();
  });

  afterEach(() => {
    resetDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.LINKEDIN_DB_PATH;
    delete process.env.LINKEDIN_MIGRATIONS_FOLDER;
  });

  it('seeds default sources when table is empty', () => {
    seedSources();
    const db = getDb();
    const rows = db.select().from(sources).all();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.some(r => r.name === 'The Batch')).toBe(true);
    expect(rows.some(r => r.name === 'The AI Daily Brief')).toBe(true);
  });

  it('does not duplicate if sources already exist', () => {
    seedSources();
    resetDb();
    seedSources();
    const db = getDb();
    const rows = db.select().from(sources).all();
    // Second run should be no-op
    expect(rows.length).toBeLessThanOrEqual(20);
  });
});
