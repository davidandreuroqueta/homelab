import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const MIAMI_PATH = process.env.MIAMI_EMERGE_PATH || '/miami-emerge';

const ALLOWED_EXTENSIONS = ['.md', '.txt'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

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

  const filePath = path.join(MIAMI_PATH, ...pathSegments);
  let resolvedBase: string;
  try {
    resolvedBase = await fs.realpath(MIAMI_PATH);
  } catch {
    return NextResponse.json({ error: 'Miami eMerge repo not accessible' }, { status: 500 });
  }

  // Try exact path, then with .md extension
  let actualPath = filePath;
  try {
    await fs.access(actualPath);
  } catch {
    // Try adding .md
    actualPath = filePath + '.md';
    try {
      await fs.access(actualPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }

  let realPath: string;
  try {
    realPath = await fs.realpath(actualPath);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  if (!realPath.startsWith(resolvedBase + path.sep) && realPath !== resolvedBase) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const ext = path.extname(realPath);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: 'Only markdown and text files are served' }, { status: 403 });
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
        name: path.basename(realPath).replace(/\.(md|txt)$/, ''),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not read file' }, { status: 500 });
  }
}
