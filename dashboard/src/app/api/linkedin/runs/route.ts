import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { generationRuns } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { cronSecret } from '@/lib/linkedin/paths';
import { spawnScript } from '@/lib/linkedin/spawn-script';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = cronSecret();
  const header = req.headers.get('x-cron-secret');
  if (secret && header !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const triggeredBy = header ? 'cron' : 'manual';
  const db = getDb();
  const [run] = db.insert(generationRuns).values({
    triggeredBy,
    status: 'running',
  }).returning().all();

  spawnScript('generate-drafts.mjs', [String(run.id)]);

  return NextResponse.json({ runId: run.id, status: 'running' });
}

export async function GET() {
  const db = getDb();
  const rows = db.select().from(generationRuns).orderBy(desc(generationRuns.triggeredAt)).limit(20).all();
  return NextResponse.json({ runs: rows });
}
