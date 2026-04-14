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
