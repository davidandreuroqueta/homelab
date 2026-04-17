import { notFound } from 'next/navigation';
import { promises as fs } from 'node:fs';
import { getDb } from '@/lib/db/client';
import { drafts, published } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { PublishModal } from '@/components/linkedin/publish-modal';
import { CopyContext } from '@/components/linkedin/copy-context';
import { Badge } from '@/components/ui/badge';
import { Star, ExternalLink } from 'lucide-react';
import { voiceProfilePath } from '@/lib/linkedin/paths';

export const dynamic = 'force-dynamic';

export default async function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [draft] = db.select().from(drafts).where(eq(drafts.id, Number(id))).all();
  if (!draft) notFound();

  // Parse sources (handle both formats)
  const rawSources = JSON.parse(draft.sources);
  const sources: { type: string; url: string; title: string }[] = Array.isArray(rawSources)
    ? rawSources.map((s: unknown) =>
        typeof s === 'string'
          ? { type: 'web', url: s, title: new URL(s).hostname }
          : (s as { type: string; url: string; title: string })
      )
    : [];

  // Load voice profile
  let voiceProfile = '';
  try {
    voiceProfile = await fs.readFile(voiceProfilePath(), 'utf8');
  } catch {
    // not yet created
  }

  // Load recent published for context
  const recentPosts = db.select().from(published)
    .orderBy(desc(published.publishedAt))
    .limit(5)
    .all()
    .map((p) => p.content);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 flex-wrap">
        {draft.isStarPost && <Star className="size-5 text-accent fill-accent" />}
        <Badge variant="secondary">{draft.angle}</Badge>
        <Badge variant="outline">{draft.topic}</Badge>
        <span className="ml-auto">
          <PublishModal draftId={draft.id} defaultContent={draft.content} />
        </span>
      </header>

      {/* Draft content */}
      <div className="space-y-3">
        <pre className="whitespace-pre-wrap rounded-[10px] bg-card p-5 text-sm leading-relaxed ring-1 ring-border">
          {draft.content}
        </pre>
        <p className="text-xs text-muted-foreground">{draft.content.length} caracteres</p>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="rounded-[10px] bg-card p-4 ring-1 ring-border">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fuentes ({sources.length})
          </h3>
          <ul className="space-y-2">
            {sources.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {s.title || s.url}
                  </a>
                  <span className="ml-2 text-xs text-muted-foreground">({s.type})</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Copy context for external Claude chat */}
      <CopyContext
        draftContent={draft.content}
        topic={draft.topic}
        angle={draft.angle}
        sources={sources}
        voiceProfile={voiceProfile}
        recentPublished={recentPosts}
      />
    </div>
  );
}
