import { getDb } from './client';
import { sources } from './schema';

type SourceSeed = {
  kind: 'rss' | 'podcast' | 'web_topic';
  name: string;
  url: string;
  priority: number;
};

const DEFAULTS: SourceSeed[] = [
  { kind: 'rss', name: 'The Batch', url: 'https://www.deeplearning.ai/the-batch/feed/', priority: 9 },
  { kind: 'rss', name: 'Import AI', url: 'https://importai.substack.com/feed', priority: 9 },
  { kind: 'rss', name: 'Latent Space', url: 'https://api.substack.com/feed/podcast/1084089.rss', priority: 8 },
  { kind: 'rss', name: 'Ahead of AI', url: 'https://magazine.sebastianraschka.com/feed', priority: 8 },
  { kind: 'rss', name: "Ben's Bites", url: 'https://bensbites.beehiiv.com/feed', priority: 7 },
  { kind: 'rss', name: 'TLDR AI', url: 'https://tldr.tech/ai/rss', priority: 7 },
  { kind: 'rss', name: 'Emerj (AI Business)', url: 'https://emerj.com/feed/', priority: 8 },
  { kind: 'rss', name: 'Finextra', url: 'https://www.finextra.com/rss/headlines.aspx', priority: 7 },
  { kind: 'rss', name: 'arXiv cs.LG', url: 'http://export.arxiv.org/rss/cs.LG', priority: 6 },
  { kind: 'rss', name: 'arXiv q-fin', url: 'http://export.arxiv.org/rss/q-fin', priority: 6 },
  { kind: 'rss', name: 'Hacker News AI', url: 'https://hnrss.org/newest?q=AI+OR+artificial+intelligence', priority: 6 },
  { kind: 'rss', name: 'Papers with Code', url: 'https://paperswithcode.com/latest/feed', priority: 5 },
  { kind: 'podcast', name: 'The AI Daily Brief', url: 'https://feeds.megaphone.fm/nlw-the-ai-daily-brief', priority: 10 },
];

export function seedSources(): number {
  const db = getDb();
  const existing = db.select().from(sources).all();
  if (existing.length >= DEFAULTS.length) return 0;
  let inserted = 0;
  const existingUrls = new Set(existing.map(e => e.url));
  for (const def of DEFAULTS) {
    if (existingUrls.has(def.url)) continue;
    db.insert(sources).values({
      kind: def.kind,
      name: def.name,
      url: def.url,
      priority: def.priority,
      enabled: true,
    }).run();
    inserted++;
  }
  return inserted;
}

if (require.main === module) {
  const n = seedSources();
  console.log(`seeded ${n} sources`);
}
