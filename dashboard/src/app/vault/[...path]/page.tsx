'use client';

import { useState, useEffect, use } from 'react';
import { Search, ArrowLeft, Calendar, HardDrive } from 'lucide-react';
import Link from 'next/link';
import { usePolling } from '@/lib/hooks/use-polling';
import { FileTree, type FileNode } from '@/components/vault/file-tree';
import { MarkdownRenderer } from '@/components/vault/markdown-renderer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

interface VaultData {
  tree: FileNode[];
}

interface FileData {
  content: string;
  metadata: {
    modified: string;
    size: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function VaultFilePage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: pathSegments } = use(params);
  const filePath = pathSegments.join('/');

  const { data: vaultData } = usePolling<VaultData>('/api/vault', 30000);
  const [filter, setFilter] = useState('');
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [fileLoading, setFileLoading] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  useEffect(() => {
    async function fetchFile() {
      setFileLoading(true);
      setFileError(null);
      try {
        const res = await fetch(`/api/vault/${filePath}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setFileData(data);
      } catch (e) {
        setFileError(e instanceof Error ? e.message : 'Failed to load file');
      } finally {
        setFileLoading(false);
      }
    }
    fetchFile();
  }, [filePath]);

  const fileName = pathSegments[pathSegments.length - 1]?.replace(/\.md$/, '') ?? 'Untitled';

  return (
    <div className="space-y-4">
      {/* Back link + mobile tree toggle */}
      <div className="flex items-center gap-2">
        <Link href="/vault">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-3.5" data-icon="inline-start" />
            Vault
          </Button>
        </Link>

        {/* Mobile file tree trigger */}
        <Sheet open={mobileTreeOpen} onOpenChange={setMobileTreeOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="lg:hidden" />
            }
          >
            <Menu className="size-3.5" data-icon="inline-start" />
            Files
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Files</SheetTitle>
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-120px)]">
              <FileTree tree={vaultData?.tree ?? []} filter={filter} />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-6">
        {/* Desktop file tree */}
        <div className="hidden lg:block w-72 shrink-0">
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
                <FileTree tree={vaultData?.tree ?? []} filter={filter} />
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {fileLoading ? (
            <div className="rounded-[16px] border border-border bg-card p-8">
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-4/5 mb-2" />
              <Skeleton className="h-4 w-3/5 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : fileError ? (
            <div className="rounded-[16px] border border-border bg-card p-8 text-center">
              <p className="text-sm text-destructive">
                Failed to load file: {fileError}
              </p>
              <Link href="/vault" className="mt-2 inline-block text-sm text-accent hover:underline">
                Back to vault
              </Link>
            </div>
          ) : (
            <div className="rounded-[16px] border border-border bg-card">
              {/* File header */}
              <div className="border-b border-border px-6 py-4">
                <h1 className="text-xl font-bold tracking-tight">
                  {fileName}
                </h1>
                {fileData?.metadata && (
                  <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                    {fileData.metadata.modified && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(fileData.metadata.modified).toLocaleDateString(
                          'es-ES',
                          {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }
                        )}
                      </span>
                    )}
                    {fileData.metadata.size !== undefined && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="size-3" />
                        {formatBytes(fileData.metadata.size)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Markdown content */}
              <div className="px-6 py-6">
                <MarkdownRenderer content={fileData?.content ?? ''} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
