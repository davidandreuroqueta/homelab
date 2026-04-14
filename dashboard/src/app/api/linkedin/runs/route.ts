import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDb } from '@/lib/db/client';
import { generationRuns } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { cronSecret, scriptsDir } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Optional cron-secret check (only enforced if CRON_SECRET is set)
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

  const script = path.join(scriptsDir(), 'generate-drafts.mjs');
  const child = spawn('node', [script, String(run.id)], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();

  return NextResponse.json({ runId: run.id, status: 'running' });
}

export async function GET() {
  const db = getDb();
  const rows = db.select().from(generationRuns).orderBy(desc(generationRuns.triggeredAt)).limit(20).all();
  return NextResponse.json({ runs: rows });
}
