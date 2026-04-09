# Homelab Infrastructure

## Overview
Monorepo representing the entire homelab infrastructure running on a Celeron N5095 server (Ubuntu 24.04, 7.5GB RAM, 98GB disk).

## Architecture
- **Dashboard**: Next.js 16 + shadcn/ui app at `/dashboard/` — the homelab command center
- **Caddy**: Reverse proxy config at `/caddy/Caddyfile` — serves dashboard on :80
- **Docker Compose**: Root `docker-compose.yml` orchestrates the dashboard container
- **Submodules**: Individual service repos (tubepod) linked as git submodules

## Server Details
- **Host**: 192.168.1.142 (LAN) / 100.97.53.99 (Tailscale)
- **SSH**: `ssh homelab-claude` (user: claude)
- **Docker**: All containers run under user claude (has docker group + sudo)

## Services
| Service | Port | Type |
|---------|------|------|
| Dashboard | 3000 (proxied on :80) | Docker |
| TubePod | 8085 | Docker |
| OpenClaw | 18789-18790 | Docker |
| Caddy | 80 | systemd |
| Syncthing | - | systemd (user) |
| Tailscale | - | systemd |

## Key Paths on Server
- `/home/claude/homelab/` — this repo
- `/home/claude/vault/` — Obsidian vault (READ ONLY, synced via Syncthing)
- `/home/claude/tubepod/` — TubePod service
- `/home/claude/openclaw/` — OpenClaw service

## Development
```bash
cd dashboard && npm run dev    # Local dev server on :3000
```

## Deployment
```bash
ssh homelab-claude "cd ~/homelab && git pull && docker compose up -d --build"
```

## Rules
- NEVER modify /home/claude/vault/ — it's synced across devices
- NEVER delete running containers without explicit request
- Dashboard mounts vault as READ ONLY
- Dashboard mounts Docker socket as READ ONLY
