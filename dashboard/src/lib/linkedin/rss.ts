import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [['itunes:duration', 'itunesDuration']],
  },
});

export interface RssItem {
  title: string;
  description?: string;
  link?: string;
  guid: string;
  publishedAt: number; // unix ts
  audioUrl?: string;
  durationSeconds?: number;
}

function parseDuration(d: unknown): number | undefined {
  if (typeof d === 'number') return d;
  if (typeof d !== 'string') return undefined;
  if (/^\d+$/.test(d)) return parseInt(d, 10);
  const parts = d.split(':').map(Number);
  if (parts.some(n => Number.isNaN(n))) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

export async function parseRssFeed(xml: string): Promise<RssItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).map((item) => {
    const enclosure = (item as any).enclosure;
    const audioUrl = enclosure?.type?.startsWith('audio/') ? enclosure.url : undefined;
    const pub = item.isoDate ? Date.parse(item.isoDate) : item.pubDate ? Date.parse(item.pubDate) : Date.now();
    return {
      title: item.title ?? '(untitled)',
      description: item.contentSnippet ?? item.content,
      link: item.link,
      guid: item.guid ?? (item as any).id ?? item.link ?? item.title ?? String(pub),
      publishedAt: Math.floor(pub / 1000),
      audioUrl,
      durationSeconds: parseDuration((item as any).itunesDuration),
    };
  });
}

export async function fetchRssFeed(url: string): Promise<RssItem[]> {
  const res = await fetch(url, { headers: { 'user-agent': 'homelab-dashboard/1.0' } });
  if (!res.ok) throw new Error(`rss fetch ${res.status}: ${url}`);
  const xml = await res.text();
  return parseRssFeed(xml);
}
