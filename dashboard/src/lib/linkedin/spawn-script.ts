import { scriptsDir } from './paths';
import path from 'node:path';

/**
 * Spawns a LinkedIn script (.mjs) as a detached background process.
 * Uses require() for child_process to prevent the Next.js bundler from
 * analyzing spawn() arguments as static module paths.
 */
export function spawnScript(scriptName: string, args: string[]): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawn } = require('node:child_process') as typeof import('node:child_process');
  const scriptPath = path.join(scriptsDir(), scriptName);
  const child = spawn(process.execPath, [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
}
