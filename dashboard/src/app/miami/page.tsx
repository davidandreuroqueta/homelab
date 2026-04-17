'use client';

import { useState } from 'react';
import { Plane, Search, Calendar, Users, Target, Trophy } from 'lucide-react';
import { usePolling } from '@/lib/hooks/use-polling';
import { FileTree, type FileNode } from '@/components/vault/file-tree';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface MiamiData {
  tree: FileNode[];
}

const quickLinks = [
  { label: 'Calendario', href: '/miami/01-event/schedule.md', icon: Calendar, color: 'text-blue-400' },
  { label: 'Pitch', href: '/miami/02-strategy/pitch.md', icon: Target, color: 'text-orange-400' },
  { label: 'Checklist', href: '/miami/03-logistics/checklist.md', icon: Trophy, color: 'text-green-400' },
  { label: 'Equipo', href: '/miami/06-team/roles-at-event.md', icon: Users, color: 'text-purple-400' },
];

export default function MiamiPage() {
  const { data, loading, error } = usePolling<MiamiData>('/api/miami', 30000);
  const [filter, setFilter] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Miami eMerge</h1>
          <Badge variant="secondary" className="text-xs">22-24 Apr 2026</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Knowledge base for GPTadvisor @ eMerge Americas Startup Showcase
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* File tree */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="sticky top-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="rounded-[10px] border border-border bg-card">
              <ScrollArea className="h-[calc(100vh-280px)]">
                {loading && !data ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="p-4 text-sm text-destructive">
                    Failed to load: {error}
                  </div>
                ) : (
                  <FileTree tree={data?.tree ?? []} filter={filter} basePath="/miami" />
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Welcome content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Quick links grid */}
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-4 transition-colors hover:bg-muted"
                >
                  <Icon className={`size-5 ${link.color}`} />
                  <span className="text-sm font-medium">{link.label}</span>
                </a>
              );
            })}
          </div>

          {/* Overview card */}
          <div className="rounded-[16px] border border-border bg-card px-8 py-10">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center rounded-[14px] bg-muted p-4">
                <Plane className="size-8 text-accent" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                eMerge Americas 2026
              </h2>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground leading-relaxed">
                Miami Beach Convention Center, 22-24 abril.
                GPTadvisor en el Startup Showcase — pitch competition, booth y networking.
                Selecciona un archivo del sidebar para ver su contenido.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Prize Pool', value: '$305K' },
                { label: 'Attendees', value: '20,000+' },
                { label: 'Investors', value: '1,000+' },
                { label: 'Pitch', value: '4 min' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-lg font-bold text-accent">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
