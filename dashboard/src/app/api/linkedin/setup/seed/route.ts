import { NextRequest, NextResponse } from 'next/server';
import { seedSources } from '@/lib/db/seed';
import { cronSecret } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = cronSecret();
  const header = req.headers.get('x-cron-secret');
  if (secret && header !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const n = seedSources();
  return NextResponse.json({ inserted: n });
}
