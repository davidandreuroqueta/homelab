import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { voiceProfilePath } from '@/lib/linkedin/paths';
import { getDb } from '@/lib/db/client';
import { voiceProfileUpdates, published } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  let content = '';
  try {
    content = await fs.readFile(voiceProfilePath(), 'utf8');
  } catch {
    content = '# Voice Profile\n\n(empty — publish posts to start building)\n';
  }
  const db = getDb();
  const updates = db.select({
    id: voiceProfileUpdates.id,
    createdAt: voiceProfileUpdates.createdAt,
    summary: voiceProfileUpdates.summary,
    publishedUrl: published.linkedinUrl,
  })
    .from(voiceProfileUpdates)
    .leftJoin(published, eq(voiceProfileUpdates.triggeredByPublishedId, published.id))
    .orderBy(desc(voiceProfileUpdates.createdAt))
    .limit(20)
    .all();
  return NextResponse.json({ content, updates });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const content = String(body.content ?? '');
  await fs.writeFile(voiceProfilePath(), content, 'utf8');
  return NextResponse.json({ ok: true });
}
