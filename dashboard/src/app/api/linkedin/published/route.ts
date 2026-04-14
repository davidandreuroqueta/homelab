import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDb } from '@/lib/db/client';
import { published, drafts } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { scriptsDir } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.select().from(published).orderBy(desc(published.publishedAt)).limit(100).all();
  return NextResponse.json({ published: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const content = String(body.content ?? '').trim();
  const linkedinUrl = String(body.linkedinUrl ?? '').trim();
  const draftId = body.draftId ? Number(body.draftId) : null;
  const publishedAt = body.publishedAt ? Number(body.publishedAt) : Math.floor(Date.now() / 1000);

  if (!content || !linkedinUrl) {
    return NextResponse.json({ error: 'content and linkedinUrl required' }, { status: 400 });
  }

  const db = getDb();
  const [row] = db.insert(published).values({
    content, linkedinUrl, publishedAt, draftId,
  }).returning().all();

  if (draftId) {
    db.update(drafts).set({ status: 'published', publishedId: row.id })
      .where(eq(drafts.id, draftId)).run();
  }

  // Fire voice profile update in background
  const script = path.join(scriptsDir(), 'update-voice-profile.mjs');
  const child = spawn('node', [script, String(row.id)], {
    detached: true, stdio: 'ignore', env: process.env,
  });
  child.unref();

  return NextResponse.json({ published: row });
}
