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
