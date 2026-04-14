import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { episodes, generationRuns } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { spawnScript } from '@/lib/linkedin/spawn-script';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episodeId = Number(id);
  const db = getDb();
  const [ep] = db.select().from(episodes).where(eq(episodes.id, episodeId)).all();
  if (!ep) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (ep.status === 'processing') {
    return NextResponse.json({ error: 'already processing' }, { status: 409 });
  }
  const [run] = db.insert(generationRuns).values({
    triggeredBy: `episode:${episodeId}`,
    status: 'running',
  }).returning().all();

  spawnScript('process-episode.mjs', [String(run.id), String(episodeId)]);

  return NextResponse.json({ runId: run.id, episodeId });
}
