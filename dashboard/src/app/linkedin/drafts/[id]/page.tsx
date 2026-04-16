import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { drafts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DraftChat } from '@/components/linkedin/draft-chat';
import { PublishModal } from '@/components/linkedin/publish-modal';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [draft] = db.select().from(drafts).where(eq(drafts.id, Number(id))).all();
  if (!draft) notFound();

  // Handle both formats: array of objects [{type,url,title}] and array of plain URL strings
  const rawSources = JSON.parse(draft.sources);
  const sources: { type: string; url: string; title: string }[] = Array.isArray(rawSources)
    ? rawSources.map((s: unknown) =>
        typeof s === 'string'
          ? { type: 'web', url: s, title: new URL(s).hostname }
          : (s as { type: string; url: string; title: string })
      )
    : [];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        {draft.isStarPost && <Star className="size-5 text-accent fill-accent" />}
        <Badge variant="secondary">{draft.angle}</Badge>
        <Badge variant="outline">{draft.topic}</Badge>
        <span className="ml-auto">
          <PublishModal draftId={draft.id} defaultContent={draft.content} />
        </span>
      </header>
      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Draft</h2>
          <pre className="whitespace-pre-wrap rounded-[10px] bg-card p-4 text-sm ring-1 ring-border">
            {draft.content}
          </pre>
          <p className="text-xs text-muted-foreground">{draft.content.length} caracteres</p>
          {sources.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Fuentes</h3>
              <ul className="space-y-1 text-xs">
                {sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {s.title || s.url}
                    </a>
                    <span className="ml-2 text-muted-foreground">({s.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="h-[70vh]">
          <DraftChat draftId={draft.id} />
        </div>
      </div>
    </div>
  );
}
