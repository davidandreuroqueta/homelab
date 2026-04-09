export interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  url?: string;
  port?: number;
  dockerContainer?: string;
  category: 'app' | 'system' | 'infra';
  healthEndpoint?: string;
}

export const services: ServiceConfig[] = [
  {
    id: 'tubepod',
    name: 'TubePod',
    description: 'YouTube → Podcast on-demand',
    icon: 'Podcast',
    url: 'http://100.97.53.99:8085',
    port: 8085,
    dockerContainer: 'tubepod',
    category: 'app',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'AI Gateway & Agent Platform',
    icon: 'Brain',
    url: 'http://100.97.53.99:18789',
    port: 18789,
    dockerContainer: 'openclaw-openclaw-gateway-1',
    category: 'app',
  },
  {
    id: 'vault',
    name: 'Vault',
    description: 'Obsidian Knowledge Base',
    icon: 'BookOpen',
    url: '/vault',
    category: 'app',
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'This homelab command center',
    icon: 'LayoutDashboard',
    url: '/',
    port: 3000,
    dockerContainer: 'homelab-dashboard',
    category: 'infra',
  },
  {
    id: 'caddy',
    name: 'Caddy',
    description: 'Web server & reverse proxy',
    icon: 'Globe',
    port: 80,
    category: 'infra',
  },
  {
    id: 'syncthing',
    name: 'Syncthing',
    description: 'File synchronization',
    icon: 'RefreshCw',
    category: 'system',
  },
  {
    id: 'tailscale',
    name: 'Tailscale',
    description: 'VPN mesh network',
    icon: 'Shield',
    category: 'system',
  },
  {
    id: 'docker',
    name: 'Docker',
    description: 'Container runtime',
    icon: 'Container',
    url: '/docker',
    category: 'infra',
  },
];
