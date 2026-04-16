import Link from 'next/link';
import { Star, Clock, Tag, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Draft } from '@/lib/db/schema';

function formatAge(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  const m = Math.floor(diff / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function DraftCard({ draft }: { draft: Draft }) {
  const preview = draft.content.slice(0, 240) + (draft.content.length > 240 ? '…' : '');
  const sourcesArr = (() => { try { const p = JSON.parse(draft.sources); return Array.isArray(p) ? p : []; } catch { return []; } })();
  const sourceCount = sourcesArr.length;
  return (
    <Link
      href={`/linkedin/drafts/${draft.id}`}
      className="flex flex-col gap-3 rounded-[10px] bg-card p-5 ring-1 ring-border transition-colors hover:ring-accent/50"
    >
      <div className="flex items-center gap-2">
        {draft.isStarPost && <Star className="size-4 text-accent fill-accent" />}
        <Badge variant="secondary" className="text-[10px]">{draft.angle}</Badge>
        <Badge variant="outline" className="text-[10px]"><Tag className="mr-1 size-3" />{draft.topic}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" /> {formatAge(draft.generatedAt)}
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground leading-snug">{draft.hook}</p>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{preview}</p>
      <div className="mt-auto flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
        <span>{draft.content.length} chars</span>
        {sourceCount > 0 && (
          <span className="flex items-center gap-1">
            <ExternalLink className="size-3" /> {sourceCount} fuente{sourceCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  );
}
