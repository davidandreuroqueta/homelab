'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, FileText, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  modified?: string;
}

function TreeItem({
  node,
  depth = 0,
  filter,
  basePath = '/vault',
}: {
  node: FileNode;
  depth?: number;
  filter: string;
  basePath?: string;
}) {
  const [open, setOpen] = useState(depth < 1);
  const pathname = usePathname();

  const matchesFilter =
    !filter || node.name.toLowerCase().includes(filter.toLowerCase());

  const childrenMatch =
    node.children?.some(
      (child) =>
        child.name.toLowerCase().includes(filter.toLowerCase()) ||
        (child.children &&
          child.children.some((c) =>
            c.name.toLowerCase().includes(filter.toLowerCase())
          ))
    ) ?? false;

  if (filter && !matchesFilter && !childrenMatch && node.type === 'file') {
    return null;
  }

  if (node.type === 'directory') {
    const hasVisibleChildren = !filter || childrenMatch || matchesFilter;
    if (!hasVisibleChildren && filter) return null;

    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150',
              open && 'rotate-90'
            )}
          />
          <Folder className="size-4 shrink-0 text-accent/70" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map((child) => (
                <TreeItem
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  filter={filter}
                  basePath={basePath}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  const hasViewableExt = node.name.endsWith('.md') || node.name.endsWith('.txt');
  if (!hasViewableExt) return null;

  const filePath = `${basePath}/${node.path}`;
  const isActive = pathname === filePath;

  return (
    <Link
      href={filePath}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150',
        isActive
          ? 'bg-accent/10 text-accent'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FileText className="size-4 shrink-0" />
      <span className="truncate">{node.name.replace(/\.(md|txt)$/, '')}</span>
    </Link>
  );
}

export function FileTree({
  tree,
  filter,
  basePath = '/vault',
}: {
  tree: FileNode[];
  filter: string;
  basePath?: string;
}) {
  if (!tree || tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No files found
      </div>
    );
  }

  return (
    <div className="space-y-0.5 py-2">
      {tree
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((node) => (
          <TreeItem key={node.path} node={node} filter={filter} basePath={basePath} />
        ))}
    </div>
  );
}
