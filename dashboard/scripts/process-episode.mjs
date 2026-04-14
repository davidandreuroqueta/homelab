#!/usr/bin/env node
// Usage: node scripts/process-episode.mjs <runId> <episodeId>

import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, createReadStream, statSync, readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import OpenAI from 'openai';

const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

async function chunkAudioIfNeeded(filePath) {
  const stats = statSync(filePath);
  if (stats.size <= WHISPER_MAX_BYTES) return [filePath];
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const pattern = path.join(dir, `${base}_part%03d.mp3`);
  await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', filePath,
      '-f', 'segment',
      '-segment_time', '1200',
      '-c', 'copy',
      pattern,
    ]);
    ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
  });
  const files = readdirSync(dir)
    .filter(f => f.startsWith(`${base}_part`))
    .map(f => path.join(dir, f))
    .sort();
  return files;
}

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
  await writeFile(audioFile, Buffer.from(ab));

  // Transcribe (possibly chunking)
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
