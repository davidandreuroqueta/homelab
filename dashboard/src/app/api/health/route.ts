import { NextResponse } from 'next/server';
import { listContainers } from '@/lib/docker';
import { services } from '@/lib/services-config';

export const dynamic = 'force-dynamic';

type ServiceStatus = {
  status: 'up' | 'down' | 'unknown';
  latency?: number;
  uptime?: string;
};

async function checkUrl(url: string): Promise<ServiceStatus> {
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return { status: 'up', latency: Date.now() - start };
  } catch {
    return { status: 'down' };
  }
}

export async function GET() {
  const results: Record<string, ServiceStatus> = {};

  // Single Docker API call for all container checks
  let containerMap: Map<string, { state: string; status: string }> = new Map();
  try {
    const containers = await listContainers();
    for (const c of containers) {
      containerMap.set(c.name, { state: c.state, status: c.status });
    }
  } catch {
    // Docker not available
  }

  // URL checks in parallel
  const urlChecks: Promise<void>[] = [];

  for (const service of services) {
    if (service.dockerContainer) {
      const c = containerMap.get(service.dockerContainer);
      if (!c) {
        results[service.id] = { status: 'unknown' };
      } else {
        results[service.id] = {
          status: c.state === 'running' ? 'up' : 'down',
          uptime: c.status,
        };
      }
    } else if (service.url && service.url.startsWith('http')) {
      urlChecks.push(
        checkUrl(service.url).then((r) => {
          results[service.id] = r;
        })
      );
    } else {
      results[service.id] = { status: 'unknown' };
    }
  }

  await Promise.all(urlChecks);

  return NextResponse.json({ services: results });
}
