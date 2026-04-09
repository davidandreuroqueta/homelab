'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Container,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePolling } from '@/lib/hooks/use-polling';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  created: string;
}

interface DockerData {
  containers: DockerContainer[];
}

function LogViewer({ containerId }: { containerId: string }) {
  const [logs, setLogs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const res = await fetch(`/api/docker/${containerId}/logs`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setLogs(data.logs);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch logs');
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [containerId]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Error fetching logs: {error}
      </div>
    );
  }

  return (
    <ScrollArea className="h-64 w-full">
      <pre className="whitespace-pre-wrap break-all p-4 font-mono text-xs text-foreground/80 leading-relaxed">
        {logs || 'No logs available.'}
      </pre>
    </ScrollArea>
  );
}

function ContainerRow({
  container,
  defaultExpanded,
}: {
  container: DockerContainer;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card className="border-0 ring-1 ring-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Circle
            className={cn(
              'size-2.5 shrink-0 fill-current',
              container.state === 'running'
                ? 'text-success'
                : 'text-muted-foreground'
            )}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{container.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {container.image}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:block text-right">
            <div
              className={cn(
                'text-xs font-medium',
                container.state === 'running'
                  ? 'text-success'
                  : 'text-muted-foreground'
              )}
            >
              {container.status}
            </div>
            {container.ports && (
              <div className="text-xs text-muted-foreground font-mono">
                {container.ports}
              </div>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">ID</span>
              <div className="truncate font-mono text-foreground/80">
                {container.id.slice(0, 12)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">State</span>
              <div className="capitalize text-foreground/80">
                {container.state}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <div className="text-foreground/80">
                {new Date(container.created).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Ports</span>
              <div className="font-mono text-foreground/80">
                {container.ports || 'None'}
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-muted/30">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                Container Logs
              </span>
            </div>
            <LogViewer containerId={container.id} />
          </div>
        </div>
      )}
    </Card>
  );
}

export function DockerContent() {
  const searchParams = useSearchParams();
  const logsParam = searchParams.get('logs');
  const { data, error, loading, refetch } = usePolling<DockerData>(
    '/api/docker',
    15000
  );

  const containers = data?.containers ?? [];
  const running = containers.filter((c) => c.state === 'running').length;
  const stopped = containers.filter((c) => c.state !== 'running').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Docker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Container management and logs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="size-3.5" data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 ring-1 ring-border">
          <CardContent className="py-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{containers.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 ring-1 ring-border">
          <CardContent className="py-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{running}</div>
              <div className="text-xs text-muted-foreground">Running</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 ring-1 ring-border">
          <CardContent className="py-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                {stopped}
              </div>
              <div className="text-xs text-muted-foreground">Stopped</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Container list */}
      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[10px]" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-0 ring-1 ring-border">
          <CardContent className="py-8 text-center">
            <Container className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Failed to load containers: {error}
            </p>
          </CardContent>
        </Card>
      ) : containers.length === 0 ? (
        <Card className="border-0 ring-1 ring-border">
          <CardContent className="py-8 text-center">
            <Container className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No containers found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {containers.map((container) => (
            <ContainerRow
              key={container.id}
              container={container}
              defaultExpanded={
                logsParam === container.name || logsParam === container.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
