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
