'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, HardDrive, Cpu, MemoryStick, Container, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { services } from '@/lib/services-config';
import { ServiceCard, type ServiceHealth } from '@/components/dashboard/service-card';

function CurrentTime() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function update() {
      setTime(
        new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="font-mono text-accent tabular-nums">{time || '--:--:--'}</span>;
}

function ProgressBar({
  value,
  max,
  label,
  color = 'accent',
}: {
  value: number;
  max: number;
  label: string;
  color?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const colorClass =
    color === 'success'
      ? 'bg-success'
      : color === 'info'
        ? 'bg-info'
        : color === 'destructive'
          ? 'bg-destructive'
          : 'bg-accent';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground/70">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface SystemData {
  hostname?: string;
  cpu?: { usage: number };
  memory?: { used: number; total: number };
  disk?: { used: number; total: number };
}

interface DockerData {
  containers?: Array<{
    id: string;
    name: string;
    state: string;
  }>;
}

interface HealthData {
  services: Record<string, ServiceHealth>;
}

interface VaultData {
  tree?: Array<{
    name: string;
    path: string;
    type: string;
    modified?: string;
    children?: Array<{
      name: string;
      path: string;
      type: string;
      modified?: string;
    }>;
  }>;
}

function flattenFiles(
  nodes: VaultData['tree'],
  acc: Array<{ name: string; path: string; modified?: string }> = []
) {
  if (!nodes) return acc;
  for (const node of nodes) {
    if (node.type === 'file' && node.name.endsWith('.md')) {
      acc.push({ name: node.name, path: node.path, modified: node.modified });
    }
    if (node.children) {
      flattenFiles(node.children as VaultData['tree'], acc);
    }
  }
  return acc;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function DashboardContent() {
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [dockerData, setDockerData] = useState<DockerData | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);

  useEffect(() => {
    async function fetchAll() {
      const [sysRes, dockRes, healthRes, vaultRes] = await Promise.allSettled([
        fetch('/api/system'),
        fetch('/api/docker'),
        fetch('/api/health'),
        fetch('/api/vault'),
      ]);
      if (sysRes.status === 'fulfilled' && sysRes.value.ok) {
        setSystemData(await sysRes.value.json());
      }
      if (dockRes.status === 'fulfilled' && dockRes.value.ok) {
        setDockerData(await dockRes.value.json());
      }
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        setHealthData(await healthRes.value.json());
      }
      if (vaultRes.status === 'fulfilled' && vaultRes.value.ok) {
        setVaultData(await vaultRes.value.json());
      }
    }
    fetchAll();
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, []);

  const hostname = systemData?.hostname ?? 'homelab';
  const runningContainers =
    dockerData?.containers?.filter((c) => c.state === 'running').length ?? 0;
  const totalContainers = dockerData?.containers?.length ?? 0;

  const recentFiles = flattenFiles(vaultData?.tree)
    .sort((a, b) => {
      if (!a.modified || !b.modified) return 0;
      return new Date(b.modified).getTime() - new Date(a.modified).getTime();
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-[16px] border border-border bg-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to{' '}
              <span className="text-accent">{hostname}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your homelab command center
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <CurrentTime />
          </div>
        </div>
      </div>

      {/* Service status cards - bento grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {services
          .filter((s) => s.category === 'app')
          .map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              health={healthData?.services?.[service.id]}
              size={
                service.id === 'tubepod' || service.id === 'openclaw'
                  ? 'large'
                  : 'default'
              }
            />
          ))}
        {services
          .filter((s) => s.category !== 'app')
          .map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              health={healthData?.services?.[service.id]}
            />
          ))}
      </div>

      {/* System & Docker overview */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* System overview */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-accent" />
              <CardTitle>System Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressBar
              value={systemData?.cpu?.usage ?? 0}
              max={100}
              label="CPU"
              color="accent"
            />
            <ProgressBar
              value={systemData?.memory?.used ?? 0}
              max={systemData?.memory?.total ?? 1}
              label={`Memory (${formatBytes(systemData?.memory?.used ?? 0)} / ${formatBytes(systemData?.memory?.total ?? 0)})`}
              color="info"
            />
            <ProgressBar
              value={systemData?.disk?.used ?? 0}
              max={systemData?.disk?.total ?? 1}
              label={`Disk (${formatBytes(systemData?.disk?.used ?? 0)} / ${formatBytes(systemData?.disk?.total ?? 0)})`}
              color={
                systemData?.disk?.total && systemData?.disk?.used
                  ? systemData.disk.used / systemData.disk.total > 0.9
                    ? 'destructive'
                    : 'success'
                  : 'success'
              }
            />
          </CardContent>
        </Card>

        {/* Docker overview */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Container className="size-4 text-accent" />
              <CardTitle>Docker Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[10px] bg-muted p-4 text-center">
                <div className="text-3xl font-bold text-success">
                  {runningContainers}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Running
                </div>
              </div>
              <div className="rounded-[10px] bg-muted p-4 text-center">
                <div className="text-3xl font-bold text-foreground">
                  {totalContainers}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Total</div>
              </div>
            </div>
            {dockerData?.containers && dockerData.containers.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {dockerData.containers.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="truncate font-mono text-foreground/70">
                      {c.name}
                    </span>
                    <span
                      className={
                        c.state === 'running'
                          ? 'text-success'
                          : 'text-muted-foreground'
                      }
                    >
                      {c.state}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/docker"
              className="mt-4 block text-center text-xs text-accent hover:underline"
            >
              View all containers
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent vault notes */}
      <Card className="border-0 ring-1 ring-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-accent" />
            <CardTitle>Recent Vault Notes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {recentFiles.length > 0 ? (
            <div className="space-y-2">
              {recentFiles.map((file) => (
                <Link
                  key={file.path}
                  href={`/vault/${file.path}`}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {file.name.replace(/\.md$/, '')}
                    </span>
                  </div>
                  {file.modified && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(file.modified).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No vault notes found. Connect your Obsidian vault to see recent files.
            </p>
          )}
          <Link
            href="/vault"
            className="mt-4 block text-center text-xs text-accent hover:underline"
          >
            Browse vault
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
