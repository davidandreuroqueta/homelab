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
  const env = {
    ...process.env,
    ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}),
    ...opts.extraEnv,
  };
  // Never pass ANTHROPIC_API_KEY — would override OAuth
  delete (env as Record<string, unknown>).ANTHROPIC_API_KEY;

  const start = Date.now();
  return new Promise<ClaudeRunResult>((resolve) => {
    const child = spawn(claudeBinary(), [...args, prompt], {
      cwd: opts.cwd,
      env: env as NodeJS.ProcessEnv,
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
