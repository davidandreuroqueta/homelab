import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const MIAMI_PATH = process.env.MIAMI_EMERGE_PATH || '/miami-emerge';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  modified?: string;
}

async function buildTree(
  dirPath: string,
  relativePath = ''
): Promise<FileNode[]> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, relPath);
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children,
      });
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
      try {
        const stat = await fs.stat(fullPath);
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          modified: stat.mtime.toISOString(),
        });
      } catch {
        // Skip files we can't stat
      }
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function GET() {
  try {
    const tree = await buildTree(MIAMI_PATH);
    return NextResponse.json({ tree });
  } catch {
    return NextResponse.json({ tree: [], error: 'Miami eMerge repo not accessible' });
  }
}
