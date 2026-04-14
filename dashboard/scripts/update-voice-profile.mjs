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
