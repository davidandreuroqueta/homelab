import { describe, it, expect } from 'vitest';
import { parseRssFeed } from './rss';

const SAMPLE = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Episode A</title>
      <description>Some desc</description>
      <guid>abc123</guid>
      <pubDate>Mon, 13 Apr 2026 10:00:00 GMT</pubDate>
      <enclosure url="https://example.com/ep-a.mp3" type="audio/mpeg" length="12345"/>
      <itunes:duration>1500</itunes:duration>
    </item>
  </channel>
</rss>`;

describe('parseRssFeed', () => {
  it('parses items with audio enclosure', async () => {
    const items = await parseRssFeed(SAMPLE);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Episode A');
    expect(items[0].guid).toBe('abc123');
    expect(items[0].audioUrl).toBe('https://example.com/ep-a.mp3');
    expect(items[0].durationSeconds).toBe(1500);
  });
});
