'use client';

import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Clock,
  Activity,
  Shield,
  Gauge,
} from 'lucide-react';
import { usePolling } from '@/lib/hooks/use-polling';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface NetworkInterface {
  name: string;
  addresses: string[];
}

interface SystemData {
  cpu: { usage: number; cores?: number; model?: string; perCore?: number[] };
  memory: { used: number; total: number; available: number; percentage: number };
  disk: { used: number; total: number; available: number; percentage: number };
  uptime: number;
  loadAvg: number[];
  interfaces: NetworkInterface[];
  hostname: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
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

function ProgressBar({
  value,
  max,
  color = 'accent',
}: {
  value: number;
  max: number;
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
          : color === 'warning'
            ? 'bg-warning'
            : 'bg-accent';

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subLabel?: string;
}) {
  return (
    <Card className="border-0 ring-1 ring-border">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-[10px] bg-muted p-2">
            <Icon className="size-4 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="truncate text-lg font-bold">{value}</div>
            {subLabel && (
              <div className="text-xs text-muted-foreground">{subLabel}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemPage() {
  const { data, error, loading } = usePolling<SystemData>(
    '/api/system',
    10000
  );

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            System monitoring and resource usage
          </p>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[10px]" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-[10px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System</h1>
        </div>
        <Card className="border-0 ring-1 ring-border">
          <CardContent className="py-8 text-center">
            <Activity className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Failed to load system data: {error}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cpuPct = data?.cpu?.usage ?? 0;
  const memUsed = data?.memory?.used ?? 0;
  const memTotal = data?.memory?.total ?? 1;
  const memAvail = data?.memory?.available ?? 0;
  const diskUsed = data?.disk?.used ?? 0;
  const diskTotal = data?.disk?.total ?? 1;
  const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  const tailscaleIf = data?.interfaces?.find((i) =>
    i.name.startsWith('tailscale') || i.name === 'tailscale0'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System monitoring and resource usage
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Hostname"
          value={data?.hostname ?? '---'}
        />
        <StatCard
          icon={Clock}
          label="Uptime"
          value={data?.uptime ? formatUptime(data.uptime) : '---'}
        />
        <StatCard
          icon={Gauge}
          label="Load Average"
          value={
            data?.loadAvg
              ? data.loadAvg.map((l) => l.toFixed(2)).join(', ')
              : '---'
          }
          subLabel="1m, 5m, 15m"
        />
        <StatCard
          icon={Cpu}
          label="CPU Cores"
          value={data?.cpu?.cores?.toString() ?? '---'}
        />
      </div>

      {/* Resource cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* CPU */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-accent" />
              <CardTitle>CPU Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold tabular-nums">
                {cpuPct.toFixed(1)}%
              </span>
              {data?.cpu?.cores && (
                <span className="text-sm text-muted-foreground">
                  {data.cpu.cores} cores
                </span>
              )}
            </div>
            <ProgressBar
              value={cpuPct}
              max={100}
              color={cpuPct > 80 ? 'destructive' : cpuPct > 50 ? 'warning' : 'accent'}
            />
          </CardContent>
        </Card>

        {/* Memory */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MemoryStick className="size-4 text-info" />
              <CardTitle>Memory Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold tabular-nums">
                {((memUsed / memTotal) * 100).toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">
                {formatBytes(memUsed)} / {formatBytes(memTotal)}
              </span>
            </div>
            <ProgressBar value={memUsed} max={memTotal} color="info" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Available: {formatBytes(memAvail)}</span>
              <span>Used: {formatBytes(memUsed)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Disk */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HardDrive className="size-4 text-success" />
              <CardTitle>Disk Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold tabular-nums">
                {diskPct.toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">
                {formatBytes(diskUsed)} / {formatBytes(diskTotal)}
              </span>
            </div>
            <ProgressBar
              value={diskUsed}
              max={diskTotal}
              color={diskPct > 90 ? 'destructive' : 'success'}
            />
          </CardContent>
        </Card>

        {/* Network */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="size-4 text-accent" />
              <CardTitle>Network</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.interfaces && data.interfaces.length > 0 ? (
                data.interfaces.map((iface) => (
                  <div
                    key={iface.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{iface.name}</span>
                    <span className="font-mono text-foreground/80">
                      {iface.addresses.join(', ')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No network data available
                </p>
              )}
            </div>

            {tailscaleIf && (
              <div className="mt-4 rounded-[10px] bg-muted p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Shield className="size-3.5 text-accent" />
                  <span>Tailscale Connected</span>
                </div>
                <div className="mt-1 font-mono text-xs text-foreground/70">
                  {tailscaleIf.addresses.join(', ')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
