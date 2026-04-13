# LinkedIn Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/linkedin` section to the existing homelab dashboard that generates 5 daily LinkedIn post drafts via Claude CLI (subscription OAuth), with in-dashboard chat refinement, manual episode processing via Whisper, voice profile learning from published posts, and manual trigger button.

**Architecture:** SQLite (via Drizzle) stores drafts, published posts, chat history, sources, episodes, and run logs. Node scripts (`scripts/*.mjs`) spawn `claude` CLI headless with scoped tools. Scripts run inside the dashboard Docker container. System cron on the homelab curls `POST /api/linkedin/runs` daily at 7am to trigger generation. Voice profile is a mounted `voice-profile.md` edited by Claude post-publish.

**Tech Stack:** Next.js 16 (RSC) + React 19, Drizzle ORM + better-sqlite3, Vitest, rss-parser, openai (Whisper only), child_process.spawn for claude CLI.

**Full spec:** `docs/superpowers/specs/2026-04-13-linkedin-command-center-design.md`

---

## Phase 1 — Foundation & Database

### Task 1: Install dependencies & set up Vitest

**Files:**
- Modify: `dashboard/package.json`
- Create: `dashboard/vitest.config.ts`
- Create: `dashboard/tsconfig.test.json`

- [ ] **Step 1: Install runtime deps**

Run:
```bash
cd /home/david/code/homelab/dashboard
npm install drizzle-orm better-sqlite3 rss-parser openai uuid
npm install -D drizzle-kit @types/better-sqlite3 @types/uuid vitest @vitest/ui tsx
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.mjs'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 3: Add scripts to `package.json`**

Replace the `scripts` section:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push",
  "db:seed": "tsx src/lib/db/seed.ts"
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/david/code/homelab
git add dashboard/package.json dashboard/package-lock.json dashboard/vitest.config.ts
git commit -m "chore: add drizzle, vitest, and linkedin deps"
```

---

### Task 2: Drizzle schema

**Files:**
- Create: `dashboard/src/lib/db/schema.ts`
- Create: `dashboard/drizzle.config.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.LINKEDIN_DB_PATH ?? './data/linkedin.db',
  },
} satisfies Config;
```

- [ ] **Step 2: Create `src/lib/db/schema.ts`**

```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(), // 'rss' | 'podcast' | 'web_topic'
  name: text('name').notNull(),
  url: text('url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(5),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  podcastSourceId: integer('podcast_source_id').notNull().references(() => sources.id),
  guid: text('guid').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  audioUrl: text('audio_url').notNull(),
  durationSeconds: integer('duration_seconds'),
  publishedAt: integer('published_at').notNull(),
  transcript: text('transcript'),
  status: text('status').notNull().default('available'), // 'available' | 'processing' | 'transcribed' | 'drafted' | 'failed'
  transcribedAt: integer('transcribed_at'),
  error: text('error'),
});

export const generationRuns = sqliteTable('generation_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredAt: integer('triggered_at').notNull().default(sql`(unixepoch())`),
  triggeredBy: text('triggered_by').notNull(), // 'cron' | 'manual' | 'episode:{id}'
  status: text('status').notNull().default('running'), // 'running' | 'success' | 'error'
  claudeOutputLog: text('claude_output_log'),
  draftsGeneratedCount: integer('drafts_generated_count').notNull().default(0),
  durationMs: integer('duration_ms'),
  error: text('error'),
});

export const published = sqliteTable('published', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id'),
  content: text('content').notNull(),
  linkedinUrl: text('linkedin_url').notNull(),
  publishedAt: integer('published_at').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

export const drafts = sqliteTable('drafts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batchId: text('batch_id').notNull(),
  runId: integer('run_id').references(() => generationRuns.id),
  generatedAt: integer('generated_at').notNull().default(sql`(unixepoch())`),
  topic: text('topic').notNull(),
  angle: text('angle').notNull(),
  isStarPost: integer('is_star_post', { mode: 'boolean' }).notNull().default(false),
  content: text('content').notNull(),
  hook: text('hook').notNull(),
  sources: text('sources').notNull().default('[]'), // JSON
  status: text('status').notNull().default('pending'), // 'pending' | 'discarded' | 'published' | 'iterating'
  publishedId: integer('published_id').references(() => published.id),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id').notNull().references(() => drafts.id),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

export const voiceProfileUpdates = sqliteTable('voice_profile_updates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredByPublishedId: integer('triggered_by_published_id').references(() => published.id),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  summary: text('summary'), // Short note from Claude about what changed
});

// Relations
export const draftsRelations = relations(drafts, ({ many, one }) => ({
  chatMessages: many(chatMessages),
  run: one(generationRuns, {
    fields: [drafts.runId],
    references: [generationRuns.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  draft: one(drafts, {
    fields: [chatMessages.draftId],
    references: [drafts.id],
  }),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  source: one(sources, {
    fields: [episodes.podcastSourceId],
    references: [sources.id],
  }),
}));

// Exported types
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type Published = typeof published.$inferSelect;
export type NewPublished = typeof published.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type NewEpisode = typeof episodes.$inferInsert;
export type GenerationRun = typeof generationRuns.$inferSelect;
export type NewGenerationRun = typeof generationRuns.$inferInsert;
```

- [ ] **Step 3: Generate migration**

Run (from `dashboard/`):
```bash
mkdir -p data
LINKEDIN_DB_PATH=./data/linkedin.db npx drizzle-kit generate
```

Expected: creates `src/lib/db/migrations/0000_*.sql`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/db/schema.ts dashboard/src/lib/db/migrations dashboard/drizzle.config.ts
git commit -m "feat(db): add drizzle schema for linkedin tables"
```

---

### Task 3: DB client + migrator

**Files:**
- Create: `dashboard/src/lib/db/client.ts`
- Create: `dashboard/src/lib/db/migrate.ts`

- [ ] **Step 1: Write `client.ts`**

```ts
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

export { schema };
```

- [ ] **Step 2: Write `migrate.ts`**

```ts
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
```

- [ ] **Step 3: Test migrations apply to a fresh DB**

Write `src/lib/db/migrate.test.ts`:
```ts
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
```

Run: `cd dashboard && npm test -- migrate`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/db/client.ts dashboard/src/lib/db/migrate.ts dashboard/src/lib/db/migrate.test.ts
git commit -m "feat(db): add sqlite client and migrator with tests"
```

---

### Task 4: Initial sources seed

**Files:**
- Create: `dashboard/src/lib/db/seed.ts`
- Create: `dashboard/src/lib/db/seed.test.ts`

- [ ] **Step 1: Write the test first**

`src/lib/db/seed.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runMigrations } from './migrate';
import { seedSources } from './seed';
import { getDb } from './client';
import { sources } from './schema';

describe('seedSources', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-seed-'));
    process.env.LINKEDIN_DB_PATH = path.join(tmpDir, 'seed.db');
    process.env.LINKEDIN_MIGRATIONS_FOLDER = path.resolve(__dirname, 'migrations');
    runMigrations();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.LINKEDIN_DB_PATH;
    delete process.env.LINKEDIN_MIGRATIONS_FOLDER;
    // reset cached db
    (global as any).__db = null;
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
    seedSources();
    const db = getDb();
    const rows = db.select().from(sources).all();
    // Second run should be no-op
    expect(rows.length).toBeLessThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd dashboard && npm test -- seed`
Expected: FAIL (seedSources not defined)

- [ ] **Step 3: Implement `seed.ts`**

```ts
import { getDb } from './client';
import { sources } from './schema';

type SourceSeed = {
  kind: 'rss' | 'podcast' | 'web_topic';
  name: string;
  url: string;
  priority: number;
};

const DEFAULTS: SourceSeed[] = [
  { kind: 'rss', name: 'The Batch', url: 'https://www.deeplearning.ai/the-batch/feed/', priority: 9 },
  { kind: 'rss', name: 'Import AI', url: 'https://importai.substack.com/feed', priority: 9 },
  { kind: 'rss', name: 'Latent Space', url: 'https://api.substack.com/feed/podcast/1084089.rss', priority: 8 },
  { kind: 'rss', name: 'Ahead of AI', url: 'https://magazine.sebastianraschka.com/feed', priority: 8 },
  { kind: 'rss', name: "Ben's Bites", url: 'https://bensbites.beehiiv.com/feed', priority: 7 },
  { kind: 'rss', name: 'TLDR AI', url: 'https://tldr.tech/ai/rss', priority: 7 },
  { kind: 'rss', name: 'Emerj (AI Business)', url: 'https://emerj.com/feed/', priority: 8 },
  { kind: 'rss', name: 'Finextra', url: 'https://www.finextra.com/rss/headlines.aspx', priority: 7 },
  { kind: 'rss', name: 'arXiv cs.LG', url: 'http://export.arxiv.org/rss/cs.LG', priority: 6 },
  { kind: 'rss', name: 'arXiv q-fin', url: 'http://export.arxiv.org/rss/q-fin', priority: 6 },
  { kind: 'rss', name: 'Hacker News AI', url: 'https://hnrss.org/newest?q=AI+OR+artificial+intelligence', priority: 6 },
  { kind: 'rss', name: 'Papers with Code', url: 'https://paperswithcode.com/latest/feed', priority: 5 },
  { kind: 'podcast', name: 'The AI Daily Brief', url: 'https://feeds.megaphone.fm/nlw-the-ai-daily-brief', priority: 10 },
];

export function seedSources(): number {
  const db = getDb();
  const existing = db.select().from(sources).all();
  if (existing.length >= DEFAULTS.length) return 0;
  let inserted = 0;
  const existingUrls = new Set(existing.map(e => e.url));
  for (const def of DEFAULTS) {
    if (existingUrls.has(def.url)) continue;
    db.insert(sources).values({
      kind: def.kind,
      name: def.name,
      url: def.url,
      priority: def.priority,
      enabled: true,
    }).run();
    inserted++;
  }
  return inserted;
}

if (require.main === module) {
  const n = seedSources();
  console.log(`seeded ${n} sources`);
}
```

- [ ] **Step 4: Run tests until green**

Run: `cd dashboard && npm test -- seed`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/db/seed.ts dashboard/src/lib/db/seed.test.ts
git commit -m "feat(db): add default sources seed with tests"
```

---

### Task 5: Shared types + paths helper

**Files:**
- Create: `dashboard/src/lib/linkedin/paths.ts`
- Create: `dashboard/src/lib/linkedin/types.ts`

- [ ] **Step 1: Write `paths.ts`**

```ts
import path from 'node:path';

export function scriptsDir(): string {
  return process.env.LINKEDIN_SCRIPTS_DIR ?? path.resolve('./scripts');
}

export function promptsDir(): string {
  return process.env.LINKEDIN_PROMPTS_DIR ?? path.resolve('./prompts');
}

export function voiceProfilePath(): string {
  return process.env.VOICE_PROFILE_PATH ?? path.resolve('./data/voice-profile.md');
}

export function dbPath(): string {
  return process.env.LINKEDIN_DB_PATH ?? path.resolve('./data/linkedin.db');
}

export function claudeBinary(): string {
  return process.env.CLAUDE_CLI_PATH ?? 'claude';
}

export function claudeToken(): string | undefined {
  return process.env.CLAUDE_CODE_OAUTH_TOKEN;
}

export function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export function cronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}
```

- [ ] **Step 2: Write `types.ts`**

```ts
export type DraftAngle = 'technical' | 'opinion' | 'news-summary' | 'personal';

export interface SourceRef {
  type: 'rss' | 'web' | 'episode';
  url: string;
  title: string;
}

export interface DraftPayload {
  batchId: string;
  topic: string;
  angle: DraftAngle;
  isStarPost: boolean;
  content: string;
  hook: string;
  sources: SourceRef[];
}

export interface GenerationRunSummary {
  runId: number;
  status: 'running' | 'success' | 'error';
  draftsGenerated: number;
  durationMs?: number;
  error?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/linkedin/paths.ts dashboard/src/lib/linkedin/types.ts
git commit -m "feat(linkedin): add paths helper and shared types"
```

---

## Phase 2 — Claude Runner & Scripts

### Task 6: Claude CLI runner

**Files:**
- Create: `dashboard/src/lib/linkedin/claude-runner.ts`
- Create: `dashboard/src/lib/linkedin/claude-runner.test.ts`

- [ ] **Step 1: Write the test first**

`claude-runner.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildClaudeArgs, renderPrompt } from './claude-runner';

describe('buildClaudeArgs', () => {
  it('builds headless args with required flags', () => {
    const args = buildClaudeArgs({
      allowedTools: ['Read', 'Write'],
      maxTurns: 5,
    });
    expect(args).toContain('-p');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('--permission-mode');
    expect(args).toContain('dontAsk');
    expect(args).toContain('--allowedTools');
    expect(args).toContain('Read,Write');
    expect(args).toContain('--max-turns');
    expect(args).toContain('5');
    expect(args).toContain('--no-session-persistence');
  });
});

describe('renderPrompt', () => {
  it('substitutes placeholders', () => {
    const result = renderPrompt('Hello {{name}}, db is {{dbPath}}', {
      name: 'David',
      dbPath: '/tmp/linkedin.db',
    });
    expect(result).toBe('Hello David, db is /tmp/linkedin.db');
  });

  it('leaves unknown placeholders untouched', () => {
    const result = renderPrompt('Hello {{unknown}}', {});
    expect(result).toBe('Hello {{unknown}}');
  });
});
```

Run: `cd dashboard && npm test -- claude-runner`
Expected: FAIL (not implemented)

- [ ] **Step 2: Implement `claude-runner.ts`**

```ts
import { spawn, SpawnOptions } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { claudeBinary, claudeToken, promptsDir } from './paths';

export interface ClaudeRunOptions {
  allowedTools: string[];
  maxTurns: number;
  cwd?: string;
  timeoutMs?: number;
  extraEnv?: Record<string, string>;
}

export interface ClaudeRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export function buildClaudeArgs(opts: ClaudeRunOptions): string[] {
  return [
    '-p',
    '--output-format', 'json',
    '--permission-mode', 'dontAsk',
    '--allowedTools', opts.allowedTools.join(','),
    '--max-turns', String(opts.maxTurns),
    '--no-session-persistence',
  ];
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  );
}

export async function loadPrompt(name: string, vars: Record<string, string> = {}): Promise<string> {
  const file = path.join(promptsDir(), name);
  const raw = await readFile(file, 'utf8');
  return renderPrompt(raw, vars);
}

export async function runClaude(prompt: string, opts: ClaudeRunOptions): Promise<ClaudeRunResult> {
  const args = buildClaudeArgs(opts);
  const token = claudeToken();
  const env: Record<string, string> = {
    ...process.env,
    ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}),
    ...opts.extraEnv,
  };
  // Never pass ANTHROPIC_API_KEY — would override OAuth
  delete env.ANTHROPIC_API_KEY;

  const start = Date.now();
  return new Promise<ClaudeRunResult>((resolve) => {
    const child = spawn(claudeBinary(), [...args, prompt], {
      cwd: opts.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, opts.timeoutMs)
      : null;
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        timedOut,
      });
    });
  });
}
```

- [ ] **Step 3: Run tests until green**

Run: `cd dashboard && npm test -- claude-runner`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/linkedin/claude-runner.ts dashboard/src/lib/linkedin/claude-runner.test.ts
git commit -m "feat(linkedin): add claude CLI runner with tests"
```

---

### Task 7: Prompts (markdown files)

**Files:**
- Create: `dashboard/prompts/generate-drafts.md`
- Create: `dashboard/prompts/refine-chat.md`
- Create: `dashboard/prompts/update-voice-profile.md`
- Create: `dashboard/prompts/process-episode.md`

- [ ] **Step 1: Write `generate-drafts.md`**

```markdown
# Generate LinkedIn Drafts

You are David's content researcher + ghostwriter. Generate 5 LinkedIn post drafts
about AI and AI-in-finance for David's personal account.

## Inputs (read these)

1. Voice profile (your personal style bible): read `{{voiceProfilePath}}`
2. Current SQLite DB: `{{dbPath}}` (use sqlite3 via Bash tool)
   - Sources table (enabled): `SELECT id, kind, name, url, priority FROM sources WHERE enabled=1 ORDER BY priority DESC;`
   - Recent published (last 30): `SELECT content, linkedin_url, published_at FROM published ORDER BY published_at DESC LIMIT 30;`
   - Recent drafts (last 7 days): `SELECT topic, angle, content, generated_at FROM drafts WHERE generated_at > unixepoch() - 604800;`

## Research

1. For each enabled RSS source, use WebFetch to retrieve the feed and extract items
   from the last 3 days. If a feed fails, skip it and note the failure in output.
2. Additionally run 3-5 WebSearch queries for trending AI / AI-in-finance topics
   NOT already covered by the RSS items or recent published/drafts.
3. Cross-reference against recent published posts to avoid duplication of topics.

## Select topics

- **Star topic**: the most impactful news of the day (biggest launch, controversy,
  breakthrough, or relevant finance-AI development)
- 2 **secondary topics**: interesting but less dominant than the star

## Write 5 drafts

- Draft 1: STAR topic, best angle (likely opinion or news-summary), marked
  `is_star_post=true`
- Draft 2: STAR topic, alternative technical angle
- Draft 3: STAR topic, alternative opinion/personal angle
- Draft 4: Secondary topic A, best angle
- Draft 5: Secondary topic B, best angle

## Voice constraints

- Apply voice profile rigorously (tone, structure, vocabulary, length).
- Max 2800 chars per draft (LinkedIn free-form limit ~3000 with margin).
- Each draft starts with a strong hook (first line shown in LinkedIn feed).
- No em-dashes. No generic AI phrases ("In today's rapidly evolving landscape...").
- Spanish language unless the voice profile specifies otherwise.

## Output

Run ID is: {{runId}}
Batch ID is: {{batchId}}

Insert each draft via:

```sql
INSERT INTO drafts (batch_id, run_id, topic, angle, is_star_post, content, hook, sources, status)
VALUES ('{{batchId}}', {{runId}}, '<topic>', '<angle>', <0|1>, '<content>', '<hook>', '<sources JSON>', 'pending');
```

`sources` is a JSON array like: `[{"type":"rss","url":"...","title":"..."}]`.

After all 5 inserts, update the run record:

```sql
UPDATE generation_runs SET status='success', drafts_generated_count=5, duration_ms=<elapsed>
WHERE id={{runId}};
```

If anything fails, update status='error' with an `error` message instead, and do
not roll back partial draft inserts.

Print a final JSON summary to stdout:
```json
{"runId": {{runId}}, "batchId": "{{batchId}}", "draftIds": [...], "status": "success"}
```
```

- [ ] **Step 2: Write `refine-chat.md`**

```markdown
# Refine LinkedIn Draft

You are helping David refine a LinkedIn post draft via conversation.

## Context

**Voice profile** (apply this style):
{{voiceProfile}}

**Recent published posts** (style reference):
{{recentPublished}}

**Current draft content**:
{{draftContent}}

**Conversation so far**:
{{chatHistory}}

**User's new message**:
{{userMessage}}

## Your task

Respond to David's message. If he asks for changes to the draft, provide a
revised version. Keep revisions consistent with the voice profile and the hook
style shown in recent published posts. Be concise. Do not add unrequested
preambles or post-summaries.

If your response includes a revised draft, wrap it in `<draft>...</draft>` tags
so it can be extracted and applied.
```

- [ ] **Step 3: Write `update-voice-profile.md`**

```markdown
# Update Voice Profile

You are the curator of David's LinkedIn voice profile.

## Inputs

**Current voice profile** (preserve most of it):
{{currentProfile}}

**New post David just published**:
{{newPost}}

**Last 5 published posts** (context):
{{recentPublished}}

## Task

Analyze the new post. Identify any style, tone, topic, or structural patterns
that are **NOT yet captured** in the current profile. Add or refine only what
is genuinely new and useful.

## Hard rules

- The updated profile must be 1000 words or fewer. If adding content pushes it
  over, compress existing sections.
- Do not remove useful existing guidance unless a new pattern directly
  contradicts it.
- Preserve the markdown structure (headings, bullets).
- No generic content ("David writes clearly"). Every line must be actionable.

## Output

Write ONLY the updated voice profile markdown to `{{voiceProfilePath}}`
(overwrite). Then print a one-line JSON to stdout:

```json
{"updated": true, "summary": "<what you changed>"}
```
```

- [ ] **Step 4: Write `process-episode.md`**

```markdown
# Process Podcast Episode into Drafts

Generate 3 LinkedIn post drafts based on a podcast episode David marked as interesting.

## Inputs

**Episode title**: {{episodeTitle}}
**Episode transcript**:
{{transcript}}

**Voice profile**:
Read `{{voiceProfilePath}}`

**Recent published posts**:
Query SQLite at `{{dbPath}}`:
```sql
SELECT content FROM published ORDER BY published_at DESC LIMIT 10;
```

## Write 3 drafts

1. **Key insight** — David's personal reflection on the most impactful idea from the episode
2. **Contrarian angle** — a take that challenges or complicates a point from the episode
3. **Practical takeaway** — an actionable or applied angle (especially useful if there's a finance-AI connection)

All drafts must apply the voice profile, stay under 2800 chars, and reference
the episode in sources.

## Output

Run ID: {{runId}}
Batch ID: {{batchId}}
Episode ID: {{episodeId}}

Insert into SQLite at `{{dbPath}}`:

```sql
INSERT INTO drafts (batch_id, run_id, topic, angle, is_star_post, content, hook, sources, status)
VALUES ('{{batchId}}', {{runId}}, '<topic>', '<angle>', 0, '<content>', '<hook>',
'[{"type":"episode","url":"<audioUrl>","title":"{{episodeTitle}}"}]', 'pending');
```

Then:
```sql
UPDATE episodes SET status='drafted' WHERE id={{episodeId}};
UPDATE generation_runs SET status='success', drafts_generated_count=3, duration_ms=<elapsed>
WHERE id={{runId}};
```

Print final JSON: `{"runId": {{runId}}, "episodeId": {{episodeId}}, "draftIds": [...]}`.
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/prompts/
git commit -m "feat(linkedin): add Claude prompts for all workflows"
```

---

### Task 8: generate-drafts script

**Files:**
- Create: `dashboard/scripts/generate-drafts.mjs`

- [ ] **Step 1: Write `generate-drafts.mjs`**

```js
#!/usr/bin/env node
// Usage: node scripts/generate-drafts.mjs <runId>
// Env: LINKEDIN_DB_PATH, VOICE_PROFILE_PATH, CLAUDE_CODE_OAUTH_TOKEN, LINKEDIN_PROMPTS_DIR

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

const runId = Number(process.argv[2]);
if (!Number.isInteger(runId) || runId <= 0) {
  console.error('usage: generate-drafts.mjs <runId>');
  process.exit(2);
}

const dbPath = process.env.LINKEDIN_DB_PATH ?? './data/linkedin.db';
const voicePath = process.env.VOICE_PROFILE_PATH ?? './data/voice-profile.md';
const promptsDir = process.env.LINKEDIN_PROMPTS_DIR ?? './prompts';
const claudeBin = process.env.CLAUDE_CLI_PATH ?? 'claude';

const batchId = randomUUID();

const template = readFileSync(path.join(promptsDir, 'generate-drafts.md'), 'utf8');
const prompt = template
  .replace(/\{\{voiceProfilePath\}\}/g, voicePath)
  .replace(/\{\{dbPath\}\}/g, dbPath)
  .replace(/\{\{runId\}\}/g, String(runId))
  .replace(/\{\{batchId\}\}/g, batchId);

const args = [
  '-p',
  '--output-format', 'json',
  '--permission-mode', 'dontAsk',
  '--allowedTools', 'Read,Write,Bash(sqlite3 *),WebSearch,WebFetch',
  '--max-turns', '25',
  '--no-session-persistence',
  prompt,
];

const env = { ...process.env };
delete env.ANTHROPIC_API_KEY;

const start = Date.now();
const child = spawn(claudeBin, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
let stdout = '';
let stderr = '';
child.stdout.on('data', d => (stdout += d.toString()));
child.stderr.on('data', d => (stderr += d.toString()));

const timer = setTimeout(() => {
  console.error('timeout, killing claude');
  child.kill('SIGKILL');
}, 20 * 60 * 1000); // 20 min

child.on('close', (code) => {
  clearTimeout(timer);
  const durationMs = Date.now() - start;
  const logTrimmed = (stdout + '\n---stderr---\n' + stderr).slice(0, 200_000);
  const db = new Database(dbPath);
  try {
    const run = db.prepare('SELECT status FROM generation_runs WHERE id = ?').get(runId);
    // Claude may have already updated status in its tool calls.
    if (code === 0) {
      db.prepare(`
        UPDATE generation_runs
        SET status = CASE WHEN status = 'running' THEN 'success' ELSE status END,
            claude_output_log = ?,
            duration_ms = ?
        WHERE id = ?
      `).run(logTrimmed, durationMs, runId);
    } else {
      db.prepare(`
        UPDATE generation_runs
        SET status = 'error', error = ?, claude_output_log = ?, duration_ms = ?
        WHERE id = ?
      `).run(`exit code ${code}`, logTrimmed, durationMs, runId);
    }
  } finally {
    db.close();
  }
  process.exit(code ?? 1);
});
```

- [ ] **Step 2: Make executable**

```bash
chmod +x dashboard/scripts/generate-drafts.mjs
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/scripts/generate-drafts.mjs
git commit -m "feat(scripts): add generate-drafts.mjs that spawns claude headless"
```

---

### Task 9: process-episode script

**Files:**
- Create: `dashboard/scripts/process-episode.mjs`
- Create: `dashboard/src/lib/linkedin/whisper.ts`
- Create: `dashboard/src/lib/linkedin/whisper.test.ts`

- [ ] **Step 1: Write whisper test**

`src/lib/linkedin/whisper.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { chunkAudioIfNeeded } from './whisper';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('chunkAudioIfNeeded', () => {
  it('returns single file when under 25MB', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-'));
    const file = path.join(tmp, 'tiny.mp3');
    fs.writeFileSync(file, Buffer.alloc(1024));
    const result = await chunkAudioIfNeeded(file);
    expect(result).toEqual([file]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
```

Run: `cd dashboard && npm test -- whisper`
Expected: FAIL (not implemented)

- [ ] **Step 2: Implement `whisper.ts`**

```ts
import fs from 'node:fs/promises';
import { statSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import OpenAI from 'openai';

export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

export async function chunkAudioIfNeeded(filePath: string): Promise<string[]> {
  const stats = statSync(filePath);
  if (stats.size <= WHISPER_MAX_BYTES) return [filePath];
  // Split with ffmpeg into ~20-minute segments
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const pattern = path.join(dir, `${base}_part%03d.mp3`);
  await new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', filePath,
      '-f', 'segment',
      '-segment_time', '1200',
      '-c', 'copy',
      pattern,
    ]);
    ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
  });
  const files = (await fs.readdir(dir))
    .filter(f => f.startsWith(`${base}_part`))
    .map(f => path.join(dir, f))
    .sort();
  return files;
}

export async function transcribe(filePath: string, apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const parts = await chunkAudioIfNeeded(filePath);
  const transcripts: string[] = [];
  for (const p of parts) {
    const result = await openai.audio.transcriptions.create({
      file: createReadStream(p),
      model: 'whisper-1',
    });
    transcripts.push(result.text);
  }
  return transcripts.join('\n\n');
}

export async function downloadAudio(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(buf));
}
```

- [ ] **Step 3: Run whisper tests**

Run: `cd dashboard && npm test -- whisper`
Expected: PASS

- [ ] **Step 4: Implement `process-episode.mjs`**

```js
#!/usr/bin/env node
// Usage: node scripts/process-episode.mjs <runId> <episodeId>

import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, createReadStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import OpenAI from 'openai';

const runId = Number(process.argv[2]);
const episodeId = Number(process.argv[3]);
if (!Number.isInteger(runId) || !Number.isInteger(episodeId)) {
  console.error('usage: process-episode.mjs <runId> <episodeId>');
  process.exit(2);
}

const dbPath = process.env.LINKEDIN_DB_PATH ?? './data/linkedin.db';
const voicePath = process.env.VOICE_PROFILE_PATH ?? './data/voice-profile.md';
const promptsDir = process.env.LINKEDIN_PROMPTS_DIR ?? './prompts';
const claudeBin = process.env.CLAUDE_CLI_PATH ?? 'claude';
const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) {
  console.error('OPENAI_API_KEY missing');
  process.exit(3);
}

const db = new Database(dbPath);
const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(episodeId);
if (!ep) {
  console.error('episode not found');
  process.exit(4);
}

db.prepare("UPDATE episodes SET status='processing', error=NULL WHERE id=?").run(episodeId);

const tmpDir = mkdtempSync(path.join(os.tmpdir(), `ep-${episodeId}-`));
const audioFile = path.join(tmpDir, 'audio.mp3');

try {
  // Download
  console.log(`downloading ${ep.audio_url}`);
  const res = await fetch(ep.audio_url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const ab = await res.arrayBuffer();
  const fs = await import('node:fs/promises');
  await fs.writeFile(audioFile, Buffer.from(ab));

  // Transcribe (possibly chunking)
  const { chunkAudioIfNeeded } = await import('../src/lib/linkedin/whisper.ts').catch(() =>
    import('../.next/server/chunks/whisper.js')
  );
  const openai = new OpenAI({ apiKey: openaiKey });
  const parts = await chunkAudioIfNeeded(audioFile);
  const texts = [];
  for (const p of parts) {
    const tr = await openai.audio.transcriptions.create({
      file: createReadStream(p),
      model: 'whisper-1',
    });
    texts.push(tr.text);
  }
  const transcript = texts.join('\n\n');

  db.prepare("UPDATE episodes SET transcript=?, status='transcribed', transcribed_at=unixepoch() WHERE id=?")
    .run(transcript, episodeId);

  // Now run Claude to generate drafts
  const batchId = randomUUID();
  const template = readFileSync(path.join(promptsDir, 'process-episode.md'), 'utf8');
  const prompt = template
    .replace(/\{\{voiceProfilePath\}\}/g, voicePath)
    .replace(/\{\{dbPath\}\}/g, dbPath)
    .replace(/\{\{runId\}\}/g, String(runId))
    .replace(/\{\{batchId\}\}/g, batchId)
    .replace(/\{\{episodeId\}\}/g, String(episodeId))
    .replace(/\{\{episodeTitle\}\}/g, ep.title.replace(/'/g, "''"))
    .replace(/\{\{transcript\}\}/g, transcript.slice(0, 50_000));

  const args = [
    '-p', '--output-format', 'json',
    '--permission-mode', 'dontAsk',
    '--allowedTools', 'Read,Bash(sqlite3 *)',
    '--max-turns', '15',
    '--no-session-persistence',
    prompt,
  ];
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

  const start = Date.now();
  await new Promise((resolve, reject) => {
    const child = spawn(claudeBin, args, { stdio: 'inherit', env });
    child.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`claude exit ${code}`)));
  });

  db.prepare(`
    UPDATE generation_runs SET status='success', drafts_generated_count=3, duration_ms=?
    WHERE id=?
  `).run(Date.now() - start, runId);
} catch (err) {
  db.prepare("UPDATE episodes SET status='failed', error=? WHERE id=?")
    .run(String(err?.message ?? err), episodeId);
  db.prepare("UPDATE generation_runs SET status='error', error=? WHERE id=?")
    .run(String(err?.message ?? err), runId);
  console.error(err);
  process.exit(5);
} finally {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
}
```

- [ ] **Step 5: Make executable and commit**

```bash
chmod +x dashboard/scripts/process-episode.mjs
git add dashboard/scripts/process-episode.mjs dashboard/src/lib/linkedin/whisper.ts dashboard/src/lib/linkedin/whisper.test.ts
git commit -m "feat(scripts): add process-episode script with Whisper + Claude"
```

---

### Task 10: update-voice-profile script

**Files:**
- Create: `dashboard/scripts/update-voice-profile.mjs`

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
// Usage: node scripts/update-voice-profile.mjs <publishedId>

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const publishedId = Number(process.argv[2]);
if (!Number.isInteger(publishedId)) {
  console.error('usage: update-voice-profile.mjs <publishedId>');
  process.exit(2);
}

const dbPath = process.env.LINKEDIN_DB_PATH ?? './data/linkedin.db';
const voicePath = process.env.VOICE_PROFILE_PATH ?? './data/voice-profile.md';
const promptsDir = process.env.LINKEDIN_PROMPTS_DIR ?? './prompts';
const claudeBin = process.env.CLAUDE_CLI_PATH ?? 'claude';

const db = new Database(dbPath);
const pub = db.prepare('SELECT * FROM published WHERE id=?').get(publishedId);
if (!pub) {
  console.error('published row not found');
  process.exit(3);
}
const recent = db.prepare(
  'SELECT content FROM published WHERE id != ? ORDER BY published_at DESC LIMIT 5'
).all(publishedId);

let currentProfile = '';
try {
  currentProfile = readFileSync(voicePath, 'utf8');
} catch {
  currentProfile = '# Voice Profile\n\n(empty — first update)\n';
}

const template = readFileSync(path.join(promptsDir, 'update-voice-profile.md'), 'utf8');
const prompt = template
  .replace(/\{\{voiceProfilePath\}\}/g, voicePath)
  .replace(/\{\{currentProfile\}\}/g, currentProfile)
  .replace(/\{\{newPost\}\}/g, pub.content)
  .replace(/\{\{recentPublished\}\}/g, recent.map(r => '---\n' + r.content).join('\n\n'));

const args = [
  '-p', '--output-format', 'json',
  '--permission-mode', 'dontAsk',
  '--allowedTools', 'Read,Write',
  '--max-turns', '5',
  '--no-session-persistence',
  prompt,
];
const env = { ...process.env };
delete env.ANTHROPIC_API_KEY;

const child = spawn(claudeBin, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
let out = '';
child.stdout.on('data', d => (out += d.toString()));
child.stderr.on('data', d => process.stderr.write(d));

child.on('close', (code) => {
  if (code === 0) {
    let summary = null;
    try {
      const parsed = JSON.parse(out.trim().split('\n').pop() ?? '{}');
      summary = parsed.summary ?? null;
    } catch {}
    db.prepare(
      'INSERT INTO voice_profile_updates (triggered_by_published_id, summary) VALUES (?, ?)'
    ).run(publishedId, summary);
    console.log('voice profile updated');
  } else {
    console.error(`claude exit ${code}`);
  }
  db.close();
  process.exit(code ?? 1);
});
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x dashboard/scripts/update-voice-profile.mjs
git add dashboard/scripts/update-voice-profile.mjs
git commit -m "feat(scripts): add update-voice-profile script"
```

---

### Task 11: RSS utility + tests

**Files:**
- Create: `dashboard/src/lib/linkedin/rss.ts`
- Create: `dashboard/src/lib/linkedin/rss.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { parseRssFeed } from './rss';

const SAMPLE = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Episode A</title>
      <description>Some desc</description>
      <guid>abc123</guid>
      <pubDate>Mon, 13 Apr 2026 10:00:00 GMT</pubDate>
      <enclosure url="https://example.com/ep-a.mp3" type="audio/mpeg" length="12345"/>
      <itunes:duration>1500</itunes:duration>
    </item>
  </channel>
</rss>`;

describe('parseRssFeed', () => {
  it('parses items with audio enclosure', async () => {
    const items = await parseRssFeed(SAMPLE);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Episode A');
    expect(items[0].guid).toBe('abc123');
    expect(items[0].audioUrl).toBe('https://example.com/ep-a.mp3');
    expect(items[0].durationSeconds).toBe(1500);
  });
});
```

Run: `cd dashboard && npm test -- rss`
Expected: FAIL

- [ ] **Step 2: Implement `rss.ts`**

```ts
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [['itunes:duration', 'itunesDuration']],
  },
});

export interface RssItem {
  title: string;
  description?: string;
  link?: string;
  guid: string;
  publishedAt: number; // unix ts
  audioUrl?: string;
  durationSeconds?: number;
}

function parseDuration(d: unknown): number | undefined {
  if (typeof d === 'number') return d;
  if (typeof d !== 'string') return undefined;
  if (/^\d+$/.test(d)) return parseInt(d, 10);
  const parts = d.split(':').map(Number);
  if (parts.some(n => Number.isNaN(n))) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

export async function parseRssFeed(xml: string): Promise<RssItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).map((item) => {
    const enclosure = (item as any).enclosure;
    const audioUrl = enclosure?.type?.startsWith('audio/') ? enclosure.url : undefined;
    const pub = item.isoDate ? Date.parse(item.isoDate) : item.pubDate ? Date.parse(item.pubDate) : Date.now();
    return {
      title: item.title ?? '(untitled)',
      description: item.contentSnippet ?? item.content,
      link: item.link,
      guid: item.guid ?? item.id ?? item.link ?? item.title ?? String(pub),
      publishedAt: Math.floor(pub / 1000),
      audioUrl,
      durationSeconds: parseDuration((item as any).itunesDuration),
    };
  });
}

export async function fetchRssFeed(url: string): Promise<RssItem[]> {
  const res = await fetch(url, { headers: { 'user-agent': 'homelab-dashboard/1.0' } });
  if (!res.ok) throw new Error(`rss fetch ${res.status}: ${url}`);
  const xml = await res.text();
  return parseRssFeed(xml);
}
```

- [ ] **Step 3: Run tests**

Run: `cd dashboard && npm test -- rss`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/linkedin/rss.ts dashboard/src/lib/linkedin/rss.test.ts
git commit -m "feat(linkedin): add rss parser utility with tests"
```

---

### Task 12: Episode refresh helper

**Files:**
- Create: `dashboard/src/lib/linkedin/episode-refresh.ts`

- [ ] **Step 1: Implement episode refresh**

```ts
import { getDb } from '@/lib/db/client';
import { episodes, sources } from '@/lib/db/schema';
import { fetchRssFeed } from './rss';
import { eq } from 'drizzle-orm';

export async function refreshPodcastEpisodes(podcastSourceId: number, maxAgeSeconds = 30 * 24 * 3600): Promise<number> {
  const db = getDb();
  const [podcast] = db.select().from(sources).where(eq(sources.id, podcastSourceId)).all();
  if (!podcast || podcast.kind !== 'podcast') return 0;

  let items;
  try {
    items = await fetchRssFeed(podcast.url);
  } catch (err) {
    console.error(`refresh episodes failed for source ${podcastSourceId}:`, err);
    return 0;
  }

  const now = Math.floor(Date.now() / 1000);
  const minTs = now - maxAgeSeconds;
  let inserted = 0;
  for (const item of items) {
    if (item.publishedAt < minTs) continue;
    if (!item.audioUrl) continue;
    try {
      db.insert(episodes).values({
        podcastSourceId,
        guid: item.guid,
        title: item.title,
        description: item.description ?? '',
        audioUrl: item.audioUrl,
        durationSeconds: item.durationSeconds,
        publishedAt: item.publishedAt,
        status: 'available',
      }).onConflictDoNothing().run();
      inserted++;
    } catch {
      // ignore dupes
    }
  }
  return inserted;
}

export async function refreshAllPodcasts(): Promise<number> {
  const db = getDb();
  const podcasts = db.select().from(sources).where(eq(sources.kind, 'podcast')).all();
  let total = 0;
  for (const p of podcasts) {
    total += await refreshPodcastEpisodes(p.id);
  }
  return total;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/lib/linkedin/episode-refresh.ts
git commit -m "feat(linkedin): add episode refresh helper"
```

---

## Phase 3 — API Routes

### Task 13: Runs API (trigger + status)

**Files:**
- Create: `dashboard/src/app/api/linkedin/runs/route.ts`
- Create: `dashboard/src/app/api/linkedin/runs/[id]/route.ts`

- [ ] **Step 1: Implement POST /api/linkedin/runs (manual trigger)**

`src/app/api/linkedin/runs/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDb } from '@/lib/db/client';
import { generationRuns } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { cronSecret, scriptsDir } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Optional cron-secret check (only enforced if CRON_SECRET is set)
  const secret = cronSecret();
  const header = req.headers.get('x-cron-secret');
  if (secret && header !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const triggeredBy = header ? 'cron' : 'manual';
  const db = getDb();
  const [run] = db.insert(generationRuns).values({
    triggeredBy,
    status: 'running',
  }).returning().all();

  const script = path.join(scriptsDir(), 'generate-drafts.mjs');
  const child = spawn('node', [script, String(run.id)], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();

  return NextResponse.json({ runId: run.id, status: 'running' });
}

export async function GET() {
  const db = getDb();
  const rows = db.select().from(generationRuns).orderBy(desc(generationRuns.triggeredAt)).limit(20).all();
  return NextResponse.json({ runs: rows });
}
```

- [ ] **Step 2: Implement GET /api/linkedin/runs/[id]**

`src/app/api/linkedin/runs/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { generationRuns, drafts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }
  const db = getDb();
  const [run] = db.select().from(generationRuns).where(eq(generationRuns.id, runId)).all();
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const runDrafts = db.select({
    id: drafts.id,
    topic: drafts.topic,
    angle: drafts.angle,
    isStarPost: drafts.isStarPost,
  }).from(drafts).where(eq(drafts.runId, runId)).all();
  return NextResponse.json({ run, drafts: runDrafts });
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/linkedin/runs/
git commit -m "feat(api): add linkedin runs endpoint (trigger + status)"
```

---

### Task 14: Drafts API

**Files:**
- Create: `dashboard/src/app/api/linkedin/drafts/route.ts`
- Create: `dashboard/src/app/api/linkedin/drafts/[id]/route.ts`

- [ ] **Step 1: List + detail**

`src/app/api/linkedin/drafts/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { drafts } from '@/lib/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Number(url.searchParams.get('limit') ?? '20');
  const since = url.searchParams.get('since'); // unix ts

  const db = getDb();
  const conditions = [] as ReturnType<typeof eq>[];
  if (status) conditions.push(eq(drafts.status, status));
  if (since) conditions.push(gte(drafts.generatedAt, Number(since)));

  const rows = db.select().from(drafts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(drafts.generatedAt))
    .limit(limit)
    .all();
  return NextResponse.json({ drafts: rows });
}
```

`src/app/api/linkedin/drafts/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { drafts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [draft] = db.select().from(drafts).where(eq(drafts.id, Number(id))).all();
  if (!draft) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['content', 'status', 'hook', 'topic'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no fields' }, { status: 400 });
  }
  const db = getDb();
  const [updated] = db.update(drafts).set(updates).where(eq(drafts.id, Number(id))).returning().all();
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ draft: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [updated] = db.update(drafts).set({ status: 'discarded' }).where(eq(drafts.id, Number(id))).returning().all();
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/api/linkedin/drafts/
git commit -m "feat(api): add drafts CRUD endpoints"
```

---

### Task 15: Chat API (spawns Claude per message)

**Files:**
- Create: `dashboard/src/app/api/linkedin/drafts/[id]/chat/route.ts`

- [ ] **Step 1: Implement chat POST + GET**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { chatMessages, drafts, published } from '@/lib/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import { promises as fs } from 'node:fs';
import { loadPrompt, runClaude } from '@/lib/linkedin/claude-runner';
import { voiceProfilePath } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const messages = db.select().from(chatMessages)
    .where(eq(chatMessages.draftId, Number(id)))
    .orderBy(asc(chatMessages.createdAt))
    .all();
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draftId = Number(id);
  const body = await req.json();
  const userMessage = String(body.message ?? '').trim();
  if (!userMessage) return NextResponse.json({ error: 'empty message' }, { status: 400 });

  const db = getDb();
  const [draft] = db.select().from(drafts).where(eq(drafts.id, draftId)).all();
  if (!draft) return NextResponse.json({ error: 'draft not found' }, { status: 404 });

  // Persist user message
  db.insert(chatMessages).values({ draftId, role: 'user', content: userMessage }).run();

  // Gather context
  const history = db.select().from(chatMessages)
    .where(eq(chatMessages.draftId, draftId))
    .orderBy(asc(chatMessages.createdAt))
    .all();
  const recent = db.select().from(published).orderBy(desc(published.publishedAt)).limit(5).all();
  let voice = '';
  try {
    voice = await fs.readFile(voiceProfilePath(), 'utf8');
  } catch {
    voice = '(voice profile not yet initialized)';
  }

  const historyStr = history.slice(0, -1) // exclude the just-inserted user msg
    .map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const recentStr = recent.map(p => '---\n' + p.content).join('\n\n');

  const prompt = await loadPrompt('refine-chat.md', {
    voiceProfile: voice,
    recentPublished: recentStr,
    draftContent: draft.content,
    chatHistory: historyStr,
    userMessage,
  });

  const result = await runClaude(prompt, {
    allowedTools: [],
    maxTurns: 1,
    timeoutMs: 60_000,
  });

  if (result.exitCode !== 0) {
    return NextResponse.json(
      { error: 'claude failed', stderr: result.stderr.slice(0, 500) },
      { status: 500 }
    );
  }

  // Extract reply from JSON output (claude -p --output-format json)
  let reply = result.stdout;
  try {
    const parsed = JSON.parse(result.stdout);
    reply = parsed.result ?? parsed.content ?? parsed.text ?? result.stdout;
  } catch {
    // fallback: use raw stdout
  }

  db.insert(chatMessages).values({ draftId, role: 'assistant', content: String(reply) }).run();

  return NextResponse.json({ reply, durationMs: result.durationMs });
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/api/linkedin/drafts/[id]/chat/route.ts
git commit -m "feat(api): add draft chat endpoint with claude CLI spawn"
```

---

### Task 16: Published + Sources APIs

**Files:**
- Create: `dashboard/src/app/api/linkedin/published/route.ts`
- Create: `dashboard/src/app/api/linkedin/sources/route.ts`
- Create: `dashboard/src/app/api/linkedin/sources/[id]/route.ts`

- [ ] **Step 1: Published**

`src/app/api/linkedin/published/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDb } from '@/lib/db/client';
import { published, drafts } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { scriptsDir } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.select().from(published).orderBy(desc(published.publishedAt)).limit(100).all();
  return NextResponse.json({ published: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const content = String(body.content ?? '').trim();
  const linkedinUrl = String(body.linkedinUrl ?? '').trim();
  const draftId = body.draftId ? Number(body.draftId) : null;
  const publishedAt = body.publishedAt ? Number(body.publishedAt) : Math.floor(Date.now() / 1000);

  if (!content || !linkedinUrl) {
    return NextResponse.json({ error: 'content and linkedinUrl required' }, { status: 400 });
  }

  const db = getDb();
  const [row] = db.insert(published).values({
    content, linkedinUrl, publishedAt, draftId,
  }).returning().all();

  if (draftId) {
    db.update(drafts).set({ status: 'published', publishedId: row.id })
      .where(eq(drafts.id, draftId)).run();
  }

  // Fire voice profile update in background
  const script = path.join(scriptsDir(), 'update-voice-profile.mjs');
  const child = spawn('node', [script, String(row.id)], {
    detached: true, stdio: 'ignore', env: process.env,
  });
  child.unref();

  return NextResponse.json({ published: row });
}
```

- [ ] **Step 2: Sources CRUD**

`src/app/api/linkedin/sources/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.select().from(sources).orderBy(desc(sources.priority)).all();
  return NextResponse.json({ sources: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const kind = String(body.kind ?? '');
  const name = String(body.name ?? '').trim();
  const url = String(body.url ?? '').trim();
  const priority = Number(body.priority ?? 5);
  const enabled = body.enabled !== false;

  if (!['rss', 'podcast', 'web_topic'].includes(kind) || !name || !url) {
    return NextResponse.json({ error: 'invalid fields' }, { status: 400 });
  }
  const db = getDb();
  const [row] = db.insert(sources).values({
    kind: kind as 'rss' | 'podcast' | 'web_topic',
    name, url, priority, enabled,
  }).returning().all();
  return NextResponse.json({ source: row });
}
```

`src/app/api/linkedin/sources/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['name', 'url', 'priority', 'enabled'] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];
  const db = getDb();
  const [row] = db.update(sources).set(updates).where(eq(sources.id, Number(id))).returning().all();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ source: row });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.delete(sources).where(eq(sources.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/linkedin/published/ dashboard/src/app/api/linkedin/sources/
git commit -m "feat(api): add published + sources endpoints"
```

---

### Task 17: Episodes + Voice APIs

**Files:**
- Create: `dashboard/src/app/api/linkedin/episodes/route.ts`
- Create: `dashboard/src/app/api/linkedin/episodes/[id]/process/route.ts`
- Create: `dashboard/src/app/api/linkedin/voice/route.ts`

- [ ] **Step 1: Episodes list + refresh**

`src/app/api/linkedin/episodes/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { episodes, sources } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { refreshAllPodcasts } from '@/lib/linkedin/episode-refresh';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shouldRefresh = url.searchParams.get('refresh') === '1';
  if (shouldRefresh) {
    try { await refreshAllPodcasts(); } catch (err) { console.error('refresh failed', err); }
  }
  const db = getDb();
  const rows = db.select({
    id: episodes.id,
    guid: episodes.guid,
    title: episodes.title,
    description: episodes.description,
    audioUrl: episodes.audioUrl,
    durationSeconds: episodes.durationSeconds,
    publishedAt: episodes.publishedAt,
    status: episodes.status,
    error: episodes.error,
    sourceName: sources.name,
  })
    .from(episodes)
    .leftJoin(sources, eq(episodes.podcastSourceId, sources.id))
    .orderBy(desc(episodes.publishedAt))
    .limit(50)
    .all();
  return NextResponse.json({ episodes: rows });
}
```

- [ ] **Step 2: Episode process trigger**

`src/app/api/linkedin/episodes/[id]/process/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDb } from '@/lib/db/client';
import { episodes, generationRuns } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { scriptsDir } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episodeId = Number(id);
  const db = getDb();
  const [ep] = db.select().from(episodes).where(eq(episodes.id, episodeId)).all();
  if (!ep) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (ep.status === 'processing') {
    return NextResponse.json({ error: 'already processing' }, { status: 409 });
  }
  const [run] = db.insert(generationRuns).values({
    triggeredBy: `episode:${episodeId}`,
    status: 'running',
  }).returning().all();

  const script = path.join(scriptsDir(), 'process-episode.mjs');
  const child = spawn('node', [script, String(run.id), String(episodeId)], {
    detached: true, stdio: 'ignore', env: process.env,
  });
  child.unref();

  return NextResponse.json({ runId: run.id, episodeId });
}
```

- [ ] **Step 3: Voice API**

`src/app/api/linkedin/voice/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { voiceProfilePath } from '@/lib/linkedin/paths';
import { getDb } from '@/lib/db/client';
import { voiceProfileUpdates, published } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  let content = '';
  try {
    content = await fs.readFile(voiceProfilePath(), 'utf8');
  } catch {
    content = '# Voice Profile\n\n(empty — publish posts to start building)\n';
  }
  const db = getDb();
  const updates = db.select({
    id: voiceProfileUpdates.id,
    createdAt: voiceProfileUpdates.createdAt,
    summary: voiceProfileUpdates.summary,
    publishedUrl: published.linkedinUrl,
  })
    .from(voiceProfileUpdates)
    .leftJoin(published, eq(voiceProfileUpdates.triggeredByPublishedId, published.id))
    .orderBy(desc(voiceProfileUpdates.createdAt))
    .limit(20)
    .all();
  return NextResponse.json({ content, updates });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const content = String(body.content ?? '');
  await fs.writeFile(voiceProfilePath(), content, 'utf8');
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/linkedin/episodes/ dashboard/src/app/api/linkedin/voice/
git commit -m "feat(api): add episodes + voice profile endpoints"
```

---

## Phase 4 — UI

### Task 18: Nav link + shared card component

**Files:**
- Modify: `dashboard/src/components/layout/app-shell.tsx`
- Create: `dashboard/src/components/linkedin/draft-card.tsx`

- [ ] **Step 1: Add `/linkedin` to nav**

Modify `app-shell.tsx` — replace the `navItems` constant:
```ts
import {
  LayoutDashboard, Server, Container, BookOpen, Activity, Menu, Circle, Linkedin,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/services', label: 'Services', icon: Server },
  { href: '/docker', label: 'Docker', icon: Container },
  { href: '/vault', label: 'Vault', icon: BookOpen },
  { href: '/linkedin', label: 'LinkedIn', icon: Linkedin },
  { href: '/system', label: 'System', icon: Activity },
];
```

- [ ] **Step 2: Create `DraftCard`**

`src/components/linkedin/draft-card.tsx`:
```tsx
import Link from 'next/link';
import { Star, Clock, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Draft } from '@/lib/db/schema';

function formatAge(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  const m = Math.floor(diff / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function DraftCard({ draft }: { draft: Draft }) {
  const preview = draft.content.slice(0, 240) + (draft.content.length > 240 ? '…' : '');
  return (
    <Link
      href={`/linkedin/drafts/${draft.id}`}
      className="flex flex-col gap-3 rounded-[10px] bg-card p-5 ring-1 ring-border transition-colors hover:ring-accent/50"
    >
      <div className="flex items-center gap-2">
        {draft.isStarPost && <Star className="size-4 text-accent fill-accent" />}
        <Badge variant="secondary" className="text-[10px]">{draft.angle}</Badge>
        <Badge variant="outline" className="text-[10px]"><Tag className="mr-1 size-3" />{draft.topic}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" /> {formatAge(draft.generatedAt)}
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground leading-snug">{draft.hook}</p>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{preview}</p>
      <div className="mt-auto pt-1 text-[10px] text-muted-foreground">{draft.content.length} chars</div>
    </Link>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/layout/app-shell.tsx dashboard/src/components/linkedin/draft-card.tsx
git commit -m "feat(ui): add linkedin nav link and DraftCard"
```

---

### Task 19: /linkedin page (drafts list + manual trigger)

**Files:**
- Create: `dashboard/src/app/linkedin/page.tsx`
- Create: `dashboard/src/components/linkedin/manual-trigger-button.tsx`

- [ ] **Step 1: `ManualTriggerButton` (client)**

`src/components/linkedin/manual-trigger-button.tsx`:
```tsx
'use client';
import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function ManualTriggerButton() {
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const router = useRouter();

  const poll = useCallback(async (id: number) => {
    const res = await fetch(`/api/linkedin/runs/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.run?.status === 'success' || data.run?.status === 'error') {
      setLoading(false);
      setRunId(null);
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    if (!runId) return;
    const int = setInterval(() => poll(runId), 5000);
    return () => clearInterval(int);
  }, [runId, poll]);

  async function trigger() {
    setLoading(true);
    const res = await fetch('/api/linkedin/runs', { method: 'POST' });
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setRunId(data.runId);
  }

  return (
    <Button onClick={trigger} disabled={loading} variant="default">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      {loading ? 'Claude investigando…' : 'Regenerar drafts'}
    </Button>
  );
}
```

- [ ] **Step 2: `/linkedin/page.tsx` (RSC)**

```tsx
import { getDb } from '@/lib/db/client';
import { drafts } from '@/lib/db/schema';
import { desc, gte } from 'drizzle-orm';
import { DraftCard } from '@/components/linkedin/draft-card';
import { ManualTriggerButton } from '@/components/linkedin/manual-trigger-button';

export const dynamic = 'force-dynamic';

export default async function LinkedInPage() {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - 36 * 3600; // last 36h
  const rows = db.select().from(drafts)
    .where(gte(drafts.generatedAt, since))
    .orderBy(desc(drafts.isStarPost), desc(drafts.generatedAt))
    .all();
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drafts</h1>
          <p className="text-sm text-muted-foreground">5 propuestas diarias generadas por Claude</p>
        </div>
        <ManualTriggerButton />
      </header>
      {rows.length === 0 ? (
        <div className="rounded-[10px] bg-card p-8 ring-1 ring-border text-center text-sm text-muted-foreground">
          No hay drafts recientes. Pulsa &quot;Regenerar drafts&quot; para lanzar la investigación ahora.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map(d => <DraftCard key={d.id} draft={d} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/linkedin/page.tsx dashboard/src/components/linkedin/manual-trigger-button.tsx
git commit -m "feat(ui): /linkedin page with drafts list and manual trigger"
```

---

### Task 20: Draft detail + chat

**Files:**
- Create: `dashboard/src/app/linkedin/drafts/[id]/page.tsx`
- Create: `dashboard/src/components/linkedin/draft-chat.tsx`
- Create: `dashboard/src/components/linkedin/publish-modal.tsx`

- [ ] **Step 1: `DraftChat` (client)**

`src/components/linkedin/draft-chat.tsx`:
```tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '@/lib/db/schema';

export function DraftChat({ draftId }: { draftId: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/linkedin/drafts/${draftId}/chat`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
    }
  }, [draftId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setInput('');
    setMessages(prev => [...prev, {
      id: -1, draftId, role: 'user', content: text, createdAt: Math.floor(Date.now() / 1000),
    } as ChatMessage]);
    try {
      const res = await fetch(`/api/linkedin/drafts/${draftId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 rounded-[10px] bg-card p-4 ring-1 ring-border">
        {messages.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">Empieza la conversación para refinar este draft.</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={
              m.role === 'user'
                ? 'inline-block max-w-[85%] rounded-lg bg-accent/15 px-3 py-2 text-sm text-foreground'
                : 'inline-block max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground whitespace-pre-wrap'
            }>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Claude está pensando…
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
          rows={2}
          placeholder="Refina este draft… (Cmd/Ctrl+Enter para enviar)"
          className="flex-1 resize-none rounded-[10px] bg-card p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
        />
        <Button onClick={send} disabled={loading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `PublishModal`**

`src/components/linkedin/publish-modal.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function PublishModal({ draftId, defaultContent }: { draftId: number; defaultContent: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(defaultContent);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    const res = await fetch('/api/linkedin/published', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draftId, content, linkedinUrl: url }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.push('/linkedin/published');
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Marcar como publicado</Button>;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="w-full max-w-2xl space-y-4 rounded-[10px] bg-card p-6 ring-1 ring-border">
        <h2 className="text-lg font-semibold">Registrar post publicado</h2>
        <label className="block text-xs text-muted-foreground">Contenido final (como apareció en LinkedIn)</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={10}
          className="w-full rounded-[10px] bg-background p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
        />
        <label className="block text-xs text-muted-foreground">URL del post en LinkedIn</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.linkedin.com/posts/..."
          className="w-full rounded-[10px] bg-background p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !url}>
            {saving ? 'Guardando…' : 'Guardar y actualizar voz'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Draft detail page**

`src/app/linkedin/drafts/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { drafts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DraftChat } from '@/components/linkedin/draft-chat';
import { PublishModal } from '@/components/linkedin/publish-modal';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [draft] = db.select().from(drafts).where(eq(drafts.id, Number(id))).all();
  if (!draft) notFound();

  const sources = JSON.parse(draft.sources) as { type: string; url: string; title: string }[];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        {draft.isStarPost && <Star className="size-5 text-accent fill-accent" />}
        <Badge variant="secondary">{draft.angle}</Badge>
        <Badge variant="outline">{draft.topic}</Badge>
        <span className="ml-auto">
          <PublishModal draftId={draft.id} defaultContent={draft.content} />
        </span>
      </header>
      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Draft</h2>
          <pre className="whitespace-pre-wrap rounded-[10px] bg-card p-4 text-sm ring-1 ring-border">
            {draft.content}
          </pre>
          <p className="text-xs text-muted-foreground">{draft.content.length} caracteres</p>
          {sources.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Fuentes</h3>
              <ul className="space-y-1 text-xs">
                {sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {s.title || s.url}
                    </a>
                    <span className="ml-2 text-muted-foreground">({s.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="h-[70vh]">
          <DraftChat draftId={draft.id} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/linkedin/drafts/ dashboard/src/components/linkedin/draft-chat.tsx dashboard/src/components/linkedin/publish-modal.tsx
git commit -m "feat(ui): draft detail page with chat + publish modal"
```

---

### Task 21: /linkedin/published page

**Files:**
- Create: `dashboard/src/app/linkedin/published/page.tsx`
- Create: `dashboard/src/components/linkedin/published-form.tsx`

- [ ] **Step 1: `PublishedForm` (client)**

`src/components/linkedin/published-form.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function PublishedForm() {
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !url.trim()) return;
    setSaving(true);
    const res = await fetch('/api/linkedin/published', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, linkedinUrl: url }),
    });
    setSaving(false);
    if (res.ok) {
      setContent('');
      setUrl('');
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-[10px] bg-card p-4 ring-1 ring-border">
      <h2 className="text-sm font-semibold">Registrar post publicado</h2>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={6}
        placeholder="Pega aquí el texto tal como lo publicaste en LinkedIn"
        className="w-full rounded-[10px] bg-background p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
      />
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="URL del post en LinkedIn"
        className="w-full rounded-[10px] bg-background p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !content.trim() || !url.trim()}>
          {saving ? 'Guardando…' : 'Guardar y actualizar voz'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Page**

`src/app/linkedin/published/page.tsx`:
```tsx
import { getDb } from '@/lib/db/client';
import { published } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PublishedForm } from '@/components/linkedin/published-form';

export const dynamic = 'force-dynamic';

export default async function PublishedPage() {
  const db = getDb();
  const rows = db.select().from(published).orderBy(desc(published.publishedAt)).limit(100).all();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Publicados</h1>
        <p className="text-sm text-muted-foreground">Histórico de posts publicados en LinkedIn</p>
      </header>
      <PublishedForm />
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-[10px] bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-border">
            Aún no has registrado ningún post publicado.
          </p>
        ) : rows.map(p => (
          <article key={p.id} className="space-y-2 rounded-[10px] bg-card p-4 ring-1 ring-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(p.publishedAt * 1000).toLocaleString('es')}</span>
              <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Ver en LinkedIn ↗</a>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{p.content}</pre>
          </article>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/linkedin/published/ dashboard/src/components/linkedin/published-form.tsx
git commit -m "feat(ui): /linkedin/published page with paste form"
```

---

### Task 22: /linkedin/sources page

**Files:**
- Create: `dashboard/src/app/linkedin/sources/page.tsx`
- Create: `dashboard/src/components/linkedin/sources-client.tsx`

- [ ] **Step 1: Client component**

`src/components/linkedin/sources-client.tsx`:
```tsx
'use client';
import { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Source } from '@/lib/db/schema';

export function SourcesClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [kind, setKind] = useState<'rss' | 'podcast' | 'web_topic'>('rss');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [priority, setPriority] = useState(5);

  async function load() {
    const res = await fetch('/api/linkedin/sources');
    if (res.ok) setSources((await res.json()).sources);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/linkedin/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, name, url, priority }),
    });
    if (res.ok) {
      setName(''); setUrl(''); setPriority(5);
      load();
    }
  }

  async function toggle(s: Source) {
    await fetch(`/api/linkedin/sources/${s.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm('Eliminar esta fuente?')) return;
    await fetch(`/api/linkedin/sources/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="grid grid-cols-1 gap-3 rounded-[10px] bg-card p-4 ring-1 ring-border md:grid-cols-[120px_1fr_2fr_80px_auto]">
        <select
          value={kind}
          onChange={e => setKind(e.target.value as 'rss' | 'podcast' | 'web_topic')}
          className="rounded-[10px] bg-background p-2 text-sm ring-1 ring-border"
        >
          <option value="rss">RSS</option>
          <option value="podcast">Podcast</option>
          <option value="web_topic">Web topic</option>
        </select>
        <input
          value={name} onChange={e => setName(e.target.value)} placeholder="Nombre"
          className="rounded-[10px] bg-background p-2 text-sm ring-1 ring-border" required
        />
        <input
          value={url} onChange={e => setUrl(e.target.value)} placeholder="URL o keyword"
          className="rounded-[10px] bg-background p-2 text-sm ring-1 ring-border" required
        />
        <input
          type="number" min={1} max={10} value={priority}
          onChange={e => setPriority(Number(e.target.value))}
          className="rounded-[10px] bg-background p-2 text-sm ring-1 ring-border"
        />
        <Button type="submit"><Plus className="size-4" /></Button>
      </form>

      <div className="overflow-x-auto rounded-[10px] ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Tipo</th>
              <th className="p-3 text-left">URL</th>
              <th className="p-3 text-center">Prio</th>
              <th className="p-3 text-center">Activo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-3">{s.name}</td>
                <td className="p-3 text-xs text-muted-foreground">{s.kind}</td>
                <td className="p-3 text-xs text-muted-foreground"><code>{s.url.slice(0, 50)}{s.url.length > 50 ? '…' : ''}</code></td>
                <td className="p-3 text-center">{s.priority}</td>
                <td className="p-3 text-center">
                  <button onClick={() => toggle(s)} className="text-xs text-accent hover:underline">
                    {s.enabled ? 'sí' : 'no'}
                  </button>
                </td>
                <td className="p-3">
                  <button onClick={() => remove(s.id)} className="text-destructive hover:opacity-70">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page**

`src/app/linkedin/sources/page.tsx`:
```tsx
import { SourcesClient } from '@/components/linkedin/sources-client';

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fuentes</h1>
        <p className="text-sm text-muted-foreground">RSS feeds, podcasts y topics que alimentan la investigación diaria</p>
      </header>
      <SourcesClient />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/linkedin/sources/ dashboard/src/components/linkedin/sources-client.tsx
git commit -m "feat(ui): /linkedin/sources CRUD page"
```

---

### Task 23: /linkedin/episodes page

**Files:**
- Create: `dashboard/src/app/linkedin/episodes/page.tsx`
- Create: `dashboard/src/components/linkedin/episodes-client.tsx`

- [ ] **Step 1: Client component**

`src/components/linkedin/episodes-client.tsx`:
```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Episode {
  id: number;
  title: string;
  description: string | null;
  publishedAt: number;
  durationSeconds: number | null;
  status: string;
  error: string | null;
  sourceName: string | null;
}

export function EpisodesClient({ initial }: { initial: Episode[] }) {
  const [episodes, setEpisodes] = useState<Episode[]>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    const res = await fetch(`/api/linkedin/episodes${refresh ? '?refresh=1' : ''}`);
    if (res.ok) setEpisodes((await res.json()).episodes);
    if (refresh) setRefreshing(false);
  }, []);

  // Poll every 10s while any episode is processing
  useEffect(() => {
    const hasProcessing = episodes.some(e => e.status === 'processing');
    if (!hasProcessing) return;
    const int = setInterval(() => load(false), 5000);
    return () => clearInterval(int);
  }, [episodes, load]);

  async function process(id: number) {
    const res = await fetch(`/api/linkedin/episodes/${id}/process`, { method: 'POST' });
    if (res.ok) load(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refrescar RSS
        </Button>
      </div>
      <div className="space-y-2">
        {episodes.length === 0 && (
          <p className="rounded-[10px] bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-border">
            No hay episodios. Pulsa &quot;Refrescar RSS&quot; para buscar.
          </p>
        )}
        {episodes.map(ep => (
          <article key={ep.id} className="flex items-start gap-4 rounded-[10px] bg-card p-4 ring-1 ring-border">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{ep.sourceName}</Badge>
                <Badge variant={ep.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {ep.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(ep.publishedAt * 1000).toLocaleDateString('es')}
                  {ep.durationSeconds ? ` · ${Math.floor(ep.durationSeconds / 60)}m` : ''}
                </span>
              </div>
              <h3 className="text-sm font-semibold">{ep.title}</h3>
              {ep.description && <p className="line-clamp-2 text-xs text-muted-foreground">{ep.description}</p>}
              {ep.error && <p className="text-xs text-destructive">Error: {ep.error}</p>}
            </div>
            <Button
              onClick={() => process(ep.id)}
              disabled={ep.status === 'processing' || ep.status === 'drafted'}
              variant={ep.status === 'drafted' ? 'ghost' : 'default'}
              size="sm"
            >
              {ep.status === 'processing'
                ? <><Loader2 className="size-3 animate-spin mr-1" />Procesando</>
                : ep.status === 'drafted'
                  ? 'Con drafts'
                  : <><Play className="size-3 mr-1" />Procesar</>}
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page (RSC)**

`src/app/linkedin/episodes/page.tsx`:
```tsx
import { getDb } from '@/lib/db/client';
import { episodes, sources } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { EpisodesClient } from '@/components/linkedin/episodes-client';

export const dynamic = 'force-dynamic';

export default async function EpisodesPage() {
  const db = getDb();
  const rows = db.select({
    id: episodes.id,
    title: episodes.title,
    description: episodes.description,
    publishedAt: episodes.publishedAt,
    durationSeconds: episodes.durationSeconds,
    status: episodes.status,
    error: episodes.error,
    sourceName: sources.name,
  })
    .from(episodes)
    .leftJoin(sources, eq(episodes.podcastSourceId, sources.id))
    .orderBy(desc(episodes.publishedAt))
    .limit(50)
    .all();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Episodios</h1>
        <p className="text-sm text-muted-foreground">Episodios de podcast para convertir en drafts</p>
      </header>
      <EpisodesClient initial={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/linkedin/episodes/ dashboard/src/components/linkedin/episodes-client.tsx
git commit -m "feat(ui): /linkedin/episodes page with refresh + process"
```

---

### Task 24: /linkedin/voice page

**Files:**
- Create: `dashboard/src/app/linkedin/voice/page.tsx`
- Create: `dashboard/src/components/linkedin/voice-editor.tsx`

- [ ] **Step 1: Voice editor**

`src/components/linkedin/voice-editor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Pencil, Save, X } from 'lucide-react';

interface VoiceUpdate {
  id: number;
  createdAt: number;
  summary: string | null;
  publishedUrl: string | null;
}

export function VoiceEditor({
  initialContent,
  updates,
}: {
  initialContent: string;
  updates: VoiceUpdate[];
}) {
  const [content, setContent] = useState(initialContent);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch('/api/linkedin/voice', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (res.ok) setEditing(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => { setContent(initialContent); setEditing(false); }}>
                <X className="size-4" /> Cancelar
              </Button>
              <Button onClick={save} disabled={saving}>
                <Save className="size-4" /> {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Editar
            </Button>
          )}
        </div>
        {editing ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={30}
            className="w-full rounded-[10px] bg-background p-4 font-mono text-xs ring-1 ring-border focus:outline-none focus:ring-accent"
          />
        ) : (
          <article className="prose prose-invert max-w-none rounded-[10px] bg-card p-6 ring-1 ring-border">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </div>
      <aside className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial de actualizaciones</h2>
        <ul className="space-y-2">
          {updates.length === 0 && <li className="text-xs text-muted-foreground">Sin actualizaciones aún</li>}
          {updates.map(u => (
            <li key={u.id} className="rounded-[10px] bg-card p-3 text-xs ring-1 ring-border">
              <div className="text-muted-foreground">{new Date(u.createdAt * 1000).toLocaleString('es')}</div>
              {u.summary && <div className="mt-1 text-foreground">{u.summary}</div>}
              {u.publishedUrl && (
                <a href={u.publishedUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-accent hover:underline">
                  Post origen ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Page**

`src/app/linkedin/voice/page.tsx`:
```tsx
import { promises as fs } from 'node:fs';
import { getDb } from '@/lib/db/client';
import { voiceProfileUpdates, published } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { voiceProfilePath } from '@/lib/linkedin/paths';
import { VoiceEditor } from '@/components/linkedin/voice-editor';

export const dynamic = 'force-dynamic';

export default async function VoicePage() {
  let content = '';
  try {
    content = await fs.readFile(voiceProfilePath(), 'utf8');
  } catch {
    content = '# Voice Profile\n\n(vacío — empieza publicando posts para construir tu perfil)\n';
  }
  const db = getDb();
  const updates = db.select({
    id: voiceProfileUpdates.id,
    createdAt: voiceProfileUpdates.createdAt,
    summary: voiceProfileUpdates.summary,
    publishedUrl: published.linkedinUrl,
  })
    .from(voiceProfileUpdates)
    .leftJoin(published, eq(voiceProfileUpdates.triggeredByPublishedId, published.id))
    .orderBy(desc(voiceProfileUpdates.createdAt))
    .limit(20)
    .all();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Perfil de voz</h1>
        <p className="text-sm text-muted-foreground">
          Claude actualiza este perfil tras cada post que publicas. Puedes editarlo a mano cuando quieras.
        </p>
      </header>
      <VoiceEditor initialContent={content} updates={updates} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/linkedin/voice/ dashboard/src/components/linkedin/voice-editor.tsx
git commit -m "feat(ui): /linkedin/voice page with markdown viewer + editor"
```

---

## Phase 5 — Infrastructure

### Task 25: Dockerfile updates (Claude CLI + ffmpeg + scripts)

**Files:**
- Modify: `dashboard/Dockerfile`
- Create: `dashboard/.dockerignore` (verify exists and skip scripts/prompts/data)

- [ ] **Step 1: Update `Dockerfile`**

Replace with:
```dockerfile
# Stage 1: Install ALL dependencies (including devDeps for build)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production (lean image)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# System deps: ffmpeg for audio chunking, git for claude CLI postinstall, bash for scripts
RUN apk add --no-cache ffmpeg bash sqlite

# Install claude CLI at a pinned version
RUN npm install -g @anthropic-ai/claude-code@2.1.81

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy scripts, prompts, and production deps needed by scripts (better-sqlite3, openai)
COPY --from=deps /app/node_modules ./node_modules_scripts
COPY scripts ./scripts
COPY prompts ./prompts
COPY src/lib/linkedin/whisper.ts ./scripts/whisper.ts

# Ensure data dir exists (will be overridden by volume mount)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data /app/scripts /app/prompts

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/Dockerfile
git commit -m "build: install claude CLI + ffmpeg in dashboard image"
```

---

### Task 26: docker-compose updates

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update `docker-compose.yml`**

```yaml
services:
  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    container_name: homelab-dashboard
    restart: unless-stopped
    group_add:
      - "988"  # docker group GID for socket access
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /home/claude/vault:/vault:ro
      - /proc:/host-proc:ro
      # LinkedIn Command Center data
      - /home/claude/homelab-data/linkedin:/app/data
    hostname: homelab
    environment:
      - NODE_ENV=production
      - VAULT_PATH=/vault
      - HOST_HOSTNAME=homelab
      - HOST_LAN_IP=192.168.1.142
      - HOST_TAILSCALE_IP=100.97.53.99
      # LinkedIn
      - LINKEDIN_DB_PATH=/app/data/linkedin.db
      - LINKEDIN_MIGRATIONS_FOLDER=/app/src/lib/db/migrations
      - VOICE_PROFILE_PATH=/app/data/voice-profile.md
      - LINKEDIN_SCRIPTS_DIR=/app/scripts
      - LINKEDIN_PROMPTS_DIR=/app/prompts
      - CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - CRON_SECRET=${CRON_SECRET}
    networks:
      - homelab

networks:
  homelab:
    driver: bridge
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "build: add linkedin volumes and env vars to docker-compose"
```

---

### Task 27: Migrations + seed on container start

**Files:**
- Modify: `dashboard/Dockerfile` (add entrypoint)
- Create: `dashboard/docker-entrypoint.sh`

- [ ] **Step 1: Write entrypoint script**

`dashboard/docker-entrypoint.sh`:
```sh
#!/bin/sh
set -e

# Migrations from the compiled migrations folder
if [ -f /app/src/lib/db/migrate.js ] || [ -d /app/node_modules/drizzle-orm ]; then
  # Use a small node script to run migrations
  node -e "
  const Database = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  const db = drizzle(new Database(process.env.LINKEDIN_DB_PATH));
  migrate(db, { migrationsFolder: process.env.LINKEDIN_MIGRATIONS_FOLDER });
  console.log('migrations applied');
"
fi

exec "$@"
```

- [ ] **Step 2: Modify Dockerfile to use entrypoint**

Add before CMD:
```dockerfile
COPY docker-entrypoint.sh /docker-entrypoint.sh
USER root
RUN chmod +x /docker-entrypoint.sh
# also copy the migrations folder to a runtime path
COPY src/lib/db/migrations /app/src/lib/db/migrations
# ensure node_modules has better-sqlite3 and drizzle at runtime (standalone only includes what's needed)
COPY --from=deps /app/node_modules/better-sqlite3 /app/node_modules/better-sqlite3
COPY --from=deps /app/node_modules/drizzle-orm /app/node_modules/drizzle-orm
COPY --from=deps /app/node_modules/bindings /app/node_modules/bindings
COPY --from=deps /app/node_modules/file-uri-to-path /app/node_modules/file-uri-to-path
RUN chown -R nextjs:nodejs /app/node_modules /app/src

USER nextjs

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/docker-entrypoint.sh dashboard/Dockerfile
git commit -m "build: run migrations on container startup"
```

---

### Task 28: Host setup — token + env + cron

**Files:**
- Create: `homelab-setup/README.md` (documentation for one-time setup)

- [ ] **Step 1: Document the one-time setup**

Create `homelab-setup/linkedin-setup.md`:
```markdown
# LinkedIn Command Center — One-time Setup on Homelab

Run these steps on the homelab server (`ssh homelab-claude`).

## 1. Generate Claude Code OAuth token

On your local machine (where you're logged in to Claude Max):
```
claude setup-token
```
Copy the token output.

## 2. Set up env file on homelab

```
mkdir -p ~/homelab-data/linkedin
cat > ~/homelab/.env <<EOF
CLAUDE_CODE_OAUTH_TOKEN=<paste token here>
OPENAI_API_KEY=<your openai key, for whisper>
CRON_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 ~/homelab/.env
```

## 3. Initialize DB directory

```
mkdir -p ~/homelab-data/linkedin
touch ~/homelab-data/linkedin/voice-profile.md
```

## 4. Build + deploy

```
cd ~/homelab
git pull
docker compose up -d --build
```

## 5. Seed default sources

```
docker compose exec dashboard sh -c "cd /app && node -e \"
const Database = require('better-sqlite3');
const db = new Database(process.env.LINKEDIN_DB_PATH);
const DEFAULTS = require('./node_modules_scripts/linkedin-seeds.json');
// (alternative: run seed via drizzle tsx — easier to do manually first time)
\""
```

(Simpler: run seed via an ad-hoc docker exec of the tsx seed script. See Task 29.)

## 6. Install cron entry

Edit crontab (`crontab -e`) for user `claude`:
```
# LinkedIn drafts — daily 7am
0 7 * * * curl -fsS -X POST -H "X-Cron-Secret: $(grep CRON_SECRET ~/homelab/.env | cut -d= -f2)" http://localhost:3000/api/linkedin/runs > /home/claude/homelab/logs/linkedin-cron.log 2>&1
```

Ensure the logs dir exists:
```
mkdir -p ~/homelab/logs
```

## 7. Verify

- Open `http://homelab:3000/linkedin` in a browser (or Tailscale)
- Should see "No hay drafts recientes" with a "Regenerar drafts" button
- Click button → should show "Claude investigando…" spinner → drafts appear after a few minutes

## 8. Token rotation (yearly)

Add to calendar: `claude setup-token` again, update `~/homelab/.env`, restart:
```
docker compose restart dashboard
```
```

- [ ] **Step 2: Commit**

```bash
git add homelab-setup/linkedin-setup.md
git commit -m "docs: add one-time setup guide for linkedin command center"
```

---

### Task 29: Seed via API route for first-time setup

**Files:**
- Create: `dashboard/src/app/api/linkedin/setup/seed/route.ts`

- [ ] **Step 1: Seed endpoint**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { seedSources } from '@/lib/db/seed';
import { cronSecret } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = cronSecret();
  const header = req.headers.get('x-cron-secret');
  if (secret && header !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const n = seedSources();
  return NextResponse.json({ inserted: n });
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/api/linkedin/setup/seed/route.ts
git commit -m "feat(api): add one-time seed endpoint"
```

Update `homelab-setup/linkedin-setup.md` step 5 to:
```
curl -X POST -H "X-Cron-Secret: $(grep CRON_SECRET ~/homelab/.env | cut -d= -f2)" http://localhost:3000/api/linkedin/setup/seed
```

- [ ] **Step 3: Commit updated docs**

```bash
git add homelab-setup/linkedin-setup.md
git commit -m "docs: use seed endpoint for first-time setup"
```

---

### Task 30: Full test + smoke run

- [ ] **Step 1: Run full test suite**

```bash
cd dashboard
npm test
```
Expected: all tests PASS.

- [ ] **Step 2: Run build locally**

```bash
cd dashboard
npm run build
```
Expected: successful build with no errors.

- [ ] **Step 3: Commit any fixes**

If build or tests reveal issues, fix them and commit:
```bash
git add -A
git commit -m "fix: resolve build/test issues found during smoke run"
```

---

### Task 31: Deploy to homelab

- [ ] **Step 1: Push to origin**

```bash
cd /home/david/code/homelab
git push origin main
```

- [ ] **Step 2: Follow the setup guide on homelab**

Execute `homelab-setup/linkedin-setup.md` steps 1-7 on the homelab server via `ssh homelab-claude`.

- [ ] **Step 3: Smoke test**

- Open the dashboard, navigate to /linkedin
- Click "Regenerar drafts" — verify run starts, completes within ~5-10 min, drafts appear
- Click a draft → verify chat works (send a test message, get response in ~15-30s)
- Navigate to /linkedin/sources — verify 13 sources seeded
- Navigate to /linkedin/episodes → click "Refrescar RSS" → verify episodes appear from The AI Daily Brief
- Click "Procesar" on one episode → verify it goes through processing → transcribed → drafted states

- [ ] **Step 4: Get a code review from Codex on the deployed changes**

Run from your local machine:
```bash
cd /home/david/code/homelab
echo "Focus on: correctness of claude CLI spawn pattern, SQL injection in prompts via string replace, security of spawning processes from API routes, correctness of Drizzle queries, Next.js 16 RSC patterns." | codex review --base main~30
```
Apply any genuine issues found and commit fixes.

---

## Self-Review Checklist

1. **Spec coverage:** All 11 key decisions from spec implemented.
   - Manual trigger button: Task 19 (ManualTriggerButton)
   - Chat: Task 15 + Task 20
   - Episode processing: Task 9 + Task 17 + Task 23
   - Voice profile update: Task 10 + Task 16 (published POST triggers it) + Task 24
   - Sources CRUD: Task 16 + Task 22
   - Publication tracking: Task 16 + Task 21
   - WebSearch + RSS: built into Task 7 prompts + Task 8 script
   - All 5 sub-routes: Tasks 19-24

2. **Placeholder check:** Each task has complete code. No "TBD" or "implement X here".

3. **Type consistency:** Drizzle schema types (`Draft`, `Published`, `Source`, etc.) reused across tasks. API routes use Next.js 16 async params pattern (`{ params: Promise<{ id: string }> }`).

4. **Known risks addressed:**
   - Claude CLI version pinning (Task 25)
   - ANTHROPIC_API_KEY excluded from spawn env (Tasks 6, 8, 9, 10)
   - flock-equivalent via `detached + unref` in spawn + single `runs` row per trigger (Tasks 13, 17)
   - Whisper 25MB limit handled via ffmpeg chunking (Task 9)
   - Migrations run on container boot (Task 27)
