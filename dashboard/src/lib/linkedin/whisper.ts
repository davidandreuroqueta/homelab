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
