'use client';

import Link from 'next/link';
import {
  Podcast,
  Brain,
  BookOpen,
  LayoutDashboard,
  Globe,
  RefreshCw,
  Shield,
  Container,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ServiceConfig } from '@/lib/services-config';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Podcast,
  Brain,
  BookOpen,
  LayoutDashboard,
  Globe,
  RefreshCw,
  Shield,
  Container,
};

export interface ServiceHealth {
  status: 'up' | 'down' | 'unknown';
  latency?: number;
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block size-2 rounded-full',
        status === 'up' && 'bg-success',
        status === 'down' && 'bg-destructive',
        status === 'unknown' && 'bg-muted-foreground'
      )}
    />
  );
}

export function ServiceCard({
  service,
  health,
  size = 'default',
}: {
  service: ServiceConfig;
  health?: ServiceHealth;
  size?: 'default' | 'large';
}) {
  const Icon = iconMap[service.icon] ?? CircleDot;
  const status = health?.status ?? 'unknown';
  const statusLabel =
    status === 'up' ? 'Running' : status === 'down' ? 'Stopped' : 'Unknown';

  const isExternal = service.url?.startsWith('http');
  const href = service.url ?? '#';

  const inner = (
    <Card
      className={cn(
        'group cursor-pointer border-0 ring-1 ring-border transition-all duration-200 hover:ring-accent/40 hover:shadow-lg hover:shadow-accent/5',
        size === 'large' && 'md:col-span-2'
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'flex items-center justify-center rounded-[10px] bg-muted p-2.5 transition-colors duration-200 group-hover:bg-accent/10',
              size === 'large' && 'p-3'
            )}
          >
            <Icon
              className={cn(
                'text-muted-foreground transition-colors duration-200 group-hover:text-accent',
                size === 'large' ? 'size-6' : 'size-5'
              )}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={status} />
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          </div>
        </div>
        <CardTitle className={cn('mt-3', size === 'large' && 'text-lg')}>
          {service.name}
        </CardTitle>
        <CardDescription>{service.description}</CardDescription>
      </CardHeader>
      {size === 'large' && (
        <CardContent>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {service.port && (
              <span>
                Port <span className="font-mono text-foreground/70">{service.port}</span>
              </span>
            )}
            {service.dockerContainer && (
              <span>
                Container{' '}
                <span className="font-mono text-foreground/70">
                  {service.dockerContainer}
                </span>
              </span>
            )}
            {health?.latency !== undefined && (
              <span>
                Latency{' '}
                <span className="font-mono text-foreground/70">{health.latency}ms</span>
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={size === 'large' ? 'md:col-span-2' : ''}>
        {inner}
      </a>
    );
  }

  if (href && href !== '#') {
    return (
      <Link href={href} className={size === 'large' ? 'md:col-span-2' : ''}>
        {inner}
      </Link>
    );
  }

  return <div className={size === 'large' ? 'md:col-span-2' : ''}>{inner}</div>;
}
