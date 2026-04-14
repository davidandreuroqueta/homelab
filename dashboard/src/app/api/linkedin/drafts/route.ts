import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { drafts } from '@/lib/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Number(url.searchParams.get('limit') ?? '20');
  const since = url.searchParams.get('since'); // unix ts

  const db = getDb();
  const conditions = [] as ReturnType<typeof eq>[];
  if (status) conditions.push(eq(drafts.status, status));
  if (since) conditions.push(gte(drafts.generatedAt, Number(since)));

  const rows = db.select().from(drafts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(drafts.generatedAt))
    .limit(limit)
    .all();
  return NextResponse.json({ drafts: rows });
}
