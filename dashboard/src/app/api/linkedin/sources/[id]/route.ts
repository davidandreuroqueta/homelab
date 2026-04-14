import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['name', 'url', 'priority', 'enabled'] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];
  const db = getDb();
  const [row] = db.update(sources).set(updates).where(eq(sources.id, Number(id))).returning().all();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ source: row });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.delete(sources).where(eq(sources.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}
