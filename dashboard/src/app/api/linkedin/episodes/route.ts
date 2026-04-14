import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { episodes, sources } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { refreshAllPodcasts } from '@/lib/linkedin/episode-refresh';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shouldRefresh = url.searchParams.get('refresh') === '1';
  if (shouldRefresh) {
    try { await refreshAllPodcasts(); } catch (err) { console.error('refresh failed', err); }
  }
  const db = getDb();
  const rows = db.select({
    id: episodes.id,
    guid: episodes.guid,
    title: episodes.title,
    description: episodes.description,
    audioUrl: episodes.audioUrl,
    durationSeconds: episodes.durationSeconds,
    publishedAt: episodes.publishedAt,
    status: episodes.status,
    error: episodes.error,
    sourceName: sources.name,
  })
    .from(episodes)
    .leftJoin(sources, eq(episodes.podcastSourceId, sources.id))
    .orderBy(desc(episodes.publishedAt))
    .limit(50)
    .all();
  return NextResponse.json({ episodes: rows });
}
