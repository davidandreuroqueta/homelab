import { NextResponse } from 'next/server';
import { listContainers } from '@/lib/docker';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const containers = await listContainers();
    return NextResponse.json({ containers });
  } catch {
    return NextResponse.json({
      containers: [],
      error: 'Docker socket not available',
    });
  }
}
