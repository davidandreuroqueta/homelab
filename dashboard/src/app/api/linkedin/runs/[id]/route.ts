import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { generationRuns, drafts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }
  const db = getDb();
  const [run] = db.select().from(generationRuns).where(eq(generationRuns.id, runId)).all();
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const runDrafts = db.select({
    id: drafts.id,
    topic: drafts.topic,
    angle: drafts.angle,
    isStarPost: drafts.isStarPost,
  }).from(drafts).where(eq(drafts.runId, runId)).all();
  return NextResponse.json({ run, drafts: runDrafts });
}
