import { getDb } from '@/lib/db/client';
import { episodes, sources } from '@/lib/db/schema';
import { fetchRssFeed } from './rss';
import { eq } from 'drizzle-orm';

export async function refreshPodcastEpisodes(podcastSourceId: number, maxAgeSeconds = 30 * 24 * 3600): Promise<number> {
  const db = getDb();
  const [podcast] = db.select().from(sources).where(eq(sources.id, podcastSourceId)).all();
  if (!podcast || podcast.kind !== 'podcast') return 0;

  let items;
  try {
    items = await fetchRssFeed(podcast.url);
  } catch (err) {
    console.error(`refresh episodes failed for source ${podcastSourceId}:`, err);
    return 0;
  }

  const now = Math.floor(Date.now() / 1000);
  const minTs = now - maxAgeSeconds;
  let inserted = 0;
  for (const item of items) {
    if (item.publishedAt < minTs) continue;
    if (!item.audioUrl) continue;
    try {
      db.insert(episodes).values({
        podcastSourceId,
        guid: item.guid,
        title: item.title,
        description: item.description ?? '',
        audioUrl: item.audioUrl,
        durationSeconds: item.durationSeconds,
        publishedAt: item.publishedAt,
        status: 'available',
      }).onConflictDoNothing().run();
      inserted++;
    } catch {
      // ignore dupes
    }
  }
  return inserted;
}

export async function refreshAllPodcasts(): Promise<number> {
  const db = getDb();
  const podcasts = db.select().from(sources).where(eq(sources.kind, 'podcast')).all();
  let total = 0;
  for (const p of podcasts) {
    total += await refreshPodcastEpisodes(p.id);
  }
  return total;
}
