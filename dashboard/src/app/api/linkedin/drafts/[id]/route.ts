import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { drafts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [draft] = db.select().from(drafts).where(eq(drafts.id, Number(id))).all();
  if (!draft) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['content', 'status', 'hook', 'topic'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no fields' }, { status: 400 });
  }
  const db = getDb();
  const [updated] = db.update(drafts).set(updates).where(eq(drafts.id, Number(id))).returning().all();
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ draft: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [updated] = db.update(drafts).set({ status: 'discarded' }).where(eq(drafts.id, Number(id))).returning().all();
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
