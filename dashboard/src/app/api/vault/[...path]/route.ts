import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const VAULT_PATH = process.env.VAULT_PATH || '/vault';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  // Validate segments: reject traversal attempts
  for (const segment of pathSegments) {
    if (
      segment === '..' ||
      segment === '.' ||
      segment.startsWith('.') ||
      segment.includes('/') ||
      segment.includes('\\') ||
      segment.includes('\0')
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  const filePath = path.join(VAULT_PATH, ...pathSegments);
  const resolvedVault = await fs.realpath(VAULT_PATH);

  // Try exact path, then with .md extension
  let actualPath = filePath;
  try {
    await fs.access(actualPath);
  } catch {
    actualPath = filePath + '.md';
    try {
      await fs.access(actualPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }

  // Resolve symlinks and verify the REAL path stays within vault
  let realPath: string;
  try {
    realPath = await fs.realpath(actualPath);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  if (!realPath.startsWith(resolvedVault + path.sep) && realPath !== resolvedVault) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Only serve .md files
  if (!realPath.endsWith('.md')) {
    return NextResponse.json({ error: 'Only markdown files are served' }, { status: 403 });
  }

  const stat = await fs.stat(realPath);
  if (stat.isDirectory()) {
    return NextResponse.json({ error: 'Path is a directory' }, { status: 400 });
  }

  try {
    const content = await fs.readFile(realPath, 'utf-8');
    return NextResponse.json({
      content,
      metadata: {
        modified: stat.mtime.toISOString(),
        size: stat.size,
        name: path.basename(realPath, '.md'),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not read file' }, { status: 500 });
  }
}
