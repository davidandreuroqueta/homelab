'use client';

import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { usePolling } from '@/lib/hooks/use-polling';
import { FileTree, type FileNode } from '@/components/vault/file-tree';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface VaultData {
  tree: FileNode[];
}

export default function VaultPage() {
  const { data, loading, error } = usePolling<VaultData>('/api/vault', 30000);
  const [filter, setFilter] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse your Obsidian knowledge base
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
                    Failed to load vault: {error}
                  </div>
                ) : (
                  <FileTree tree={data?.tree ?? []} filter={filter} />
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Welcome content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col items-center justify-center rounded-[16px] border border-border bg-card px-8 py-16 text-center">
            <div className="flex items-center justify-center rounded-[14px] bg-muted p-4">
              <BookOpen className="size-8 text-accent" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">
              Welcome to Vault
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
              Select a file from the sidebar to view its contents.
              Your Obsidian notes are rendered with full Markdown support,
              including wikilinks, code blocks, and tables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
