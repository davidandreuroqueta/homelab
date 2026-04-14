'use client';
import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Episode {
  id: number;
  title: string;
  description: string | null;
  publishedAt: number;
  durationSeconds: number | null;
  status: string;
  error: string | null;
  sourceName: string | null;
}

export function EpisodesClient({ initial }: { initial: Episode[] }) {
  const [episodes, setEpisodes] = useState<Episode[]>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    const res = await fetch(`/api/linkedin/episodes${refresh ? '?refresh=1' : ''}`);
    if (res.ok) setEpisodes((await res.json()).episodes);
    if (refresh) setRefreshing(false);
  }, []);

  // Poll every 10s while any episode is processing
  useEffect(() => {
    const hasProcessing = episodes.some(e => e.status === 'processing');
    if (!hasProcessing) return;
    const int = setInterval(() => load(false), 5000);
    return () => clearInterval(int);
  }, [episodes, load]);

  async function process(id: number) {
    const res = await fetch(`/api/linkedin/episodes/${id}/process`, { method: 'POST' });
    if (res.ok) load(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refrescar RSS
        </Button>
      </div>
      <div className="space-y-2">
        {episodes.length === 0 && (
          <p className="rounded-[10px] bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-border">
            No hay episodios. Pulsa &quot;Refrescar RSS&quot; para buscar.
          </p>
        )}
        {episodes.map(ep => (
          <article key={ep.id} className="flex items-start gap-4 rounded-[10px] bg-card p-4 ring-1 ring-border">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{ep.sourceName}</Badge>
                <Badge variant={ep.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {ep.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(ep.publishedAt * 1000).toLocaleDateString('es')}
                  {ep.durationSeconds ? ` · ${Math.floor(ep.durationSeconds / 60)}m` : ''}
                </span>
              </div>
              <h3 className="text-sm font-semibold">{ep.title}</h3>
              {ep.description && <p className="line-clamp-2 text-xs text-muted-foreground">{ep.description}</p>}
              {ep.error && <p className="text-xs text-destructive">Error: {ep.error}</p>}
            </div>
            <Button
              onClick={() => process(ep.id)}
              disabled={ep.status === 'processing' || ep.status === 'drafted'}
              variant={ep.status === 'drafted' ? 'ghost' : 'default'}
              size="sm"
            >
              {ep.status === 'processing'
                ? <><Loader2 className="size-3 animate-spin mr-1" />Procesando</>
                : ep.status === 'drafted'
                  ? 'Con drafts'
                  : <><Play className="size-3 mr-1" />Procesar</>}
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
