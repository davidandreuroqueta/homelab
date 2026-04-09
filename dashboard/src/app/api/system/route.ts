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

  // Network interfaces — try reading host network from /host-proc
  let interfaces: { name: string; addresses: string[] }[] = [];
  try {
    const raw = await fs.readFile('/host-proc/net/fib_trie', 'utf-8');
    // Parse host IPs from fib_trie (fallback approach)
    const ips = new Set<string>();
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^\s+\|-- (\d+\.\d+\.\d+\.\d+)$/);
      if (match && lines[i + 1]?.includes('/32 host LOCAL')) {
        const ip = match[1];
        if (ip !== '127.0.0.1' && !ip.startsWith('172.')) ips.add(ip);
      }
    }
    if (ips.size > 0) {
      interfaces = [{ name: 'host', addresses: Array.from(ips) }];
    }
  } catch { /* fallback to container interfaces */ }

  if (interfaces.length === 0) {
    const networkInterfaces = os.networkInterfaces();
    interfaces = Object.entries(networkInterfaces)
      .filter(([name]) => !name.startsWith('lo'))
      .map(([name, addrs]) => ({
        name,
        addresses: (addrs || [])
          .filter((a) => a.family === 'IPv4')
          .map((a) => a.address),
      }))
      .filter((n) => n.addresses.length > 0);
  }

  // Try to read host hostname
  let hostname = os.hostname();
  try {
    const hostHostname = await fs.readFile('/host-proc/sys/kernel/hostname', 'utf-8');
    if (hostHostname.trim()) hostname = hostHostname.trim();
  } catch { /* use container hostname */ }

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
