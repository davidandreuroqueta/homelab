import { getDb } from '@/lib/db/client';
import { episodes, sources } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { EpisodesClient } from '@/components/linkedin/episodes-client';

export const dynamic = 'force-dynamic';

export default async function EpisodesPage() {
  const db = getDb();
  const rows = db.select({
    id: episodes.id,
    title: episodes.title,
    description: episodes.description,
    publishedAt: episodes.publishedAt,
    durationSeconds: episodes.durationSeconds,
    status: episodes.status,
    error: episodes.error,
    sourceName: sources.name,
  })
    .from(episodes)
    .leftJoin(sources, eq(episodes.podcastSourceId, sources.id))
    .orderBy(desc(episodes.publishedAt))
    .limit(50)
    .all();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Episodios</h1>
        <p className="text-sm text-muted-foreground">Episodios de podcast para convertir en drafts</p>
      </header>
      <EpisodesClient initial={rows} />
    </div>
  );
}
