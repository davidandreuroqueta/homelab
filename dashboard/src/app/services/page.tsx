'use client';

import { useState, useEffect } from 'react';
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
  ExternalLink,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { services, type ServiceConfig } from '@/lib/services-config';
import { usePolling } from '@/lib/hooks/use-polling';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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

interface HealthData {
  services: Record<
    string,
    { status: 'up' | 'down' | 'unknown'; latency?: number }
  >;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'up' && 'bg-success/10 text-success',
        status === 'down' && 'bg-destructive/10 text-destructive',
        status === 'unknown' && 'bg-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'up' && 'bg-success',
          status === 'down' && 'bg-destructive',
          status === 'unknown' && 'bg-muted-foreground'
        )}
      />
      {status === 'up' ? 'Running' : status === 'down' ? 'Stopped' : 'Unknown'}
    </span>
  );
}

function ServiceDetailCard({
  service,
  health,
}: {
  service: ServiceConfig;
  health?: { status: 'up' | 'down' | 'unknown'; latency?: number };
}) {
  const Icon = iconMap[service.icon] ?? CircleDot;
  const status = health?.status ?? 'unknown';
  const isExternal = service.url?.startsWith('http');

  return (
    <Card className="border-0 ring-1 ring-border transition-all duration-200 hover:ring-accent/30">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-[10px] bg-muted p-2.5">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>{service.name}</CardTitle>
              <CardDescription className="mt-0.5">
                {service.description}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {service.port && (
              <div>
                <span className="text-muted-foreground">Port</span>
                <div className="font-mono text-foreground/80">{service.port}</div>
              </div>
            )}
            {service.dockerContainer && (
              <div>
                <span className="text-muted-foreground">Container</span>
                <div className="truncate font-mono text-foreground/80">
                  {service.dockerContainer}
                </div>
              </div>
            )}
            {health?.latency !== undefined && (
              <div>
                <span className="text-muted-foreground">Latency</span>
                <div className="font-mono text-foreground/80">
                  {health.latency}ms
                </div>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Category</span>
              <div className="capitalize text-foreground/80">
                {service.category}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {service.url && (
              <>
                {isExternal ? (
                  <a href={service.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="size-3.5" data-icon="inline-start" />
                      Open
                    </Button>
                  </a>
                ) : (
                  <Link href={service.url}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="size-3.5" data-icon="inline-start" />
                      Open
                    </Button>
                  </Link>
                )}
              </>
            )}
            {service.dockerContainer && (
              <Link href={`/docker?logs=${service.dockerContainer}`}>
                <Button variant="ghost" size="sm">
                  <ScrollText className="size-3.5" data-icon="inline-start" />
                  Logs
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ServicesPage() {
  const { data: healthData } = usePolling<HealthData>('/api/health', 10000);
  const [activeTab, setActiveTab] = useState('all');

  const filtered =
    activeTab === 'all'
      ? services
      : services.filter((s) => s.category === activeTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All services running in your homelab
        </p>
      </div>

      <Tabs defaultValue="all" onValueChange={(val) => setActiveTab(val as string)}>
        <TabsList variant="line">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="app">Apps</TabsTrigger>
          <TabsTrigger value="infra">Infrastructure</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((service) => (
              <ServiceDetailCard
                key={service.id}
                service={service}
                health={healthData?.services?.[service.id]}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No services in this category.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
