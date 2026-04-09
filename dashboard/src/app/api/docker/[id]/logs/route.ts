import { NextResponse } from 'next/server';
import { getContainerLogs } from '@/lib/docker';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\-]*$/.test(id)) {
    return NextResponse.json(
      { logs: '', error: 'Invalid container identifier' },
      { status: 400 }
    );
  }

  try {
    const logs = await getContainerLogs(id);
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json(
      { logs: '', error: 'Could not fetch logs' },
      { status: 404 }
    );
  }
}
