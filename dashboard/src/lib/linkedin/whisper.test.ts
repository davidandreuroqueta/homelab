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
