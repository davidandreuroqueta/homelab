'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  Container,
  BookOpen,
  Activity,
  Menu,
  Circle,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/services', label: 'Services', icon: Server },
  { href: '/docker', label: 'Docker', icon: Container },
  { href: '/vault', label: 'Vault', icon: BookOpen },
  { href: '/linkedin', label: 'LinkedIn', icon: MessageSquare },
  { href: '/system', label: 'System', icon: Activity },
];

interface SystemInfo {
  hostname?: string;
  uptime?: number;
  interfaces?: { name: string; addresses: string[] }[];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors duration-200',
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="size-[18px]" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ systemInfo }: { systemInfo: SystemInfo | null }) {
  const tsIface = systemInfo?.interfaces?.find(
    (i) => i.name.startsWith('tailscale') || i.name === 'tailscale0'
  );
  const tailscaleIp = tsIface?.addresses?.[0] ?? '...';
  const hostname = systemInfo?.hostname ?? '...';
  const uptime =
    typeof systemInfo?.uptime === 'number'
      ? formatUptime(systemInfo.uptime)
      : '...';

  return (
    <div className="border-t border-border px-4 py-4">
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Hostname</span>
          <span className="font-mono text-foreground/70">{hostname}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Uptime</span>
          <span className="font-mono text-foreground/70">{uptime}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Tailscale</span>
          <span className="font-mono text-foreground/70">{tailscaleIp}</span>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function fetchSystem() {
      try {
        const res = await fetch('/api/system');
        if (res.ok) {
          const data = await res.json();
          setSystemInfo(data);
        }
      } catch {
        // silent
      }
    }

    async function fetchHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          const statuses = Object.values(
            data.services as Record<string, { status: string }>
          );
          const allUp = statuses.every((s) => s.status === 'up');
          const anyDown = statuses.some((s) => s.status === 'down');
          setHealthOk(anyDown ? false : allUp ? true : null);
        }
      } catch {
        setHealthOk(null);
      }
    }

    fetchSystem();
    fetchHealth();
    const id = setInterval(() => {
      fetchSystem();
      fetchHealth();
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border bg-sidebar">
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border">
          <Circle
            className={cn(
              'size-2.5 fill-current',
              healthOk === true && 'text-success',
              healthOk === false && 'text-destructive',
              healthOk === null && 'text-warning'
            )}
          />
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/80">
            Homelab
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
        <SidebarFooter systemInfo={systemInfo} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" />}
            >
              <Menu className="size-5" />
              <span className="sr-only">Menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border">
                <Circle
                  className={cn(
                    'size-2.5 fill-current',
                    healthOk === true && 'text-success',
                    healthOk === false && 'text-destructive',
                    healthOk === null && 'text-warning'
                  )}
                />
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/80">
                  Homelab
                </span>
              </div>
              <div className="py-4">
                <SidebarNav />
              </div>
              <SidebarFooter systemInfo={systemInfo} />
            </SheetContent>
          </Sheet>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/80">
            Homelab
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="flex h-16 items-center justify-around border-t border-border bg-sidebar md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 text-[10px] font-medium transition-colors duration-200',
                  isActive
                    ? 'text-accent'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
