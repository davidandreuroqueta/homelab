import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';

// Store previous CPU reading for delta-based usage calculation
let prevCpuTimes: { idle: number; total: number }[] | null = null;

function readCpuUsage(): number[] {
  const cpus = os.cpus();
  const currentTimes = cpus.map((cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    return { idle: cpu.times.idle, total };
  });

  if (!prevCpuTimes || prevCpuTimes.length !== currentTimes.length) {
    prevCpuTimes = currentTimes;
    // First call: return a rough estimate
    return currentTimes.map(() => 0);
  }

  const usage = currentTimes.map((curr, i) => {
    const prev = prevCpuTimes![i];
    const idleDelta = curr.idle - prev.idle;
    const totalDelta = curr.total - prev.total;
    if (totalDelta <= 0) return 0;
    return Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
  });

  prevCpuTimes = currentTimes;
  return usage;
}

async function readMemInfo(): Promise<{ total: number; used: number; available: number }> {
  // Try host /proc/meminfo for accurate available memory (includes buffers/cache)
  try {
    const raw = await fs.readFile('/host-proc/meminfo', 'utf-8');
    const lines = raw.split('\n');
    const get = (key: string) => {
      const line = lines.find((l) => l.startsWith(key + ':'));
      if (!line) return 0;
      return parseInt(line.split(/\s+/)[1], 10) * 1024; // kB to bytes
    };
    const total = get('MemTotal');
    const available = get('MemAvailable');
    return { total, used: total - available, available };
  } catch {
    // Fallback to os module
    const total = os.totalmem();
    const free = os.freemem();
    return { total, used: total - free, available: free };
  }
}

export async function GET() {
  const cpus = os.cpus();
  const perCore = readCpuUsage();
  const avgCpu = perCore.length > 0
    ? Math.round(perCore.reduce((a, b) => a + b, 0) / perCore.length)
    : 0;

  const memory = await readMemInfo();

  // Disk usage
  let disk = { total: 0, used: 0, available: 0 };
  try {
    const stats = await fs.statfs('/');
    disk = {
      total: Number(stats.blocks) * Number(stats.bsize),
      used: (Number(stats.blocks) - Number(stats.bfree)) * Number(stats.bsize),
      available: Number(stats.bavail) * Number(stats.bsize),
    };
  } catch { /* ignore */ }

  // Host uptime
  let uptimeSeconds = os.uptime();
  try {
    const raw = await fs.readFile('/host-proc/uptime', 'utf-8');
    const parsed = parseFloat(raw.split(' ')[0]);
    if (!isNaN(parsed) && parsed > 0) uptimeSeconds = parsed;
  } catch { /* use container uptime */ }

  const loadAvg = os.loadavg();

  // Network interfaces — use env vars for host IPs, fallback to container interfaces
  const interfaces: { name: string; addresses: string[] }[] = [];

  if (process.env.HOST_LAN_IP) {
    interfaces.push({ name: 'LAN', addresses: [process.env.HOST_LAN_IP] });
  }
  if (process.env.HOST_TAILSCALE_IP) {
    interfaces.push({ name: 'Tailscale', addresses: [process.env.HOST_TAILSCALE_IP] });
  }

  // Also add container's own interface
  const networkInterfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(networkInterfaces)) {
    if (name.startsWith('lo')) continue;
    const ipv4 = (addrs || []).filter((a) => a.family === 'IPv4').map((a) => a.address);
    if (ipv4.length > 0) {
      interfaces.push({ name: `Docker (${name})`, addresses: ipv4 });
    }
  }

  // Use host hostname from env or container hostname
  const hostname = process.env.HOST_HOSTNAME || os.hostname();

  return NextResponse.json({
    hostname,
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      usage: avgCpu,
      perCore,
    },
    memory: {
      total: memory.total,
      used: memory.used,
      available: memory.available,
      percentage: memory.total > 0 ? Math.round((memory.used / memory.total) * 100) : 0,
    },
    disk: {
      total: disk.total,
      used: disk.used,
      available: disk.available,
      percentage: disk.total > 0 ? Math.round((disk.used / disk.total) * 100) : 0,
    },
    uptime: uptimeSeconds,
    loadAvg: loadAvg.map((l) => Math.round(l * 100) / 100),
    interfaces,
  });
}
