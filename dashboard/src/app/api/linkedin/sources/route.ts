import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.select().from(sources).orderBy(desc(sources.priority)).all();
  return NextResponse.json({ sources: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const kind = String(body.kind ?? '');
  const name = String(body.name ?? '').trim();
  const url = String(body.url ?? '').trim();
  const priority = Number(body.priority ?? 5);
  const enabled = body.enabled !== false;

  if (!['rss', 'podcast', 'web_topic'].includes(kind) || !name || !url) {
    return NextResponse.json({ error: 'invalid fields' }, { status: 400 });
  }
  const db = getDb();
  const [row] = db.insert(sources).values({
    kind: kind as 'rss' | 'podcast' | 'web_topic',
    name, url, priority, enabled,
  }).returning().all();
  return NextResponse.json({ source: row });
}
