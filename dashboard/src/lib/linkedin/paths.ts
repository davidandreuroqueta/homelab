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
