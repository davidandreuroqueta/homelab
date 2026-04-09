import http from 'http';

const DOCKER_SOCKET = '/var/run/docker.sock';

function dockerRequest(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: DOCKER_SOCKET,
        path,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Docker API ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Docker API timeout'));
    });
    req.end();
  });
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: { private: number; public?: number; type: string }[];
  created: string;
}

export async function listContainers(): Promise<DockerContainer[]> {
  const raw = await dockerRequest('/containers/json?all=true');
  const containers = JSON.parse(raw);
  return containers.map((c: Record<string, unknown>) => ({
    id: (c.Id as string).substring(0, 12),
    name: ((c.Names as string[])[0] || '').replace(/^\//, ''),
    image: c.Image as string,
    state: c.State as string,
    status: c.Status as string,
    ports: ((c.Ports as Record<string, unknown>[]) || []).map(
      (p: Record<string, unknown>) => ({
        private: p.PrivatePort as number,
        public: p.PublicPort as number | undefined,
        type: p.Type as string,
      })
    ),
    created: new Date((c.Created as number) * 1000).toISOString(),
  }));
}

export async function getContainerLogs(
  idOrName: string,
  tail = 200
): Promise<string> {
  const raw = await dockerRequest(
    `/containers/${encodeURIComponent(idOrName)}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true`
  );
  // Strip Docker multiplexed stream 8-byte headers
  return raw
    .split('\n')
    .map((line) => line.replace(/^[\x00-\x1f]{8}/, ''))
    .join('\n');
}

export async function checkContainer(
  name: string
): Promise<{ status: 'up' | 'down' | 'unknown'; uptime?: string }> {
  try {
    const containers = await listContainers();
    const container = containers.find((c) => c.name === name);
    if (!container) return { status: 'unknown' };
    return {
      status: container.state === 'running' ? 'up' : 'down',
      uptime: container.status,
    };
  } catch {
    return { status: 'unknown' };
  }
}
