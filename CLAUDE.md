# Homelab Infrastructure

## Overview
Monorepo representing the entire homelab infrastructure running on a Celeron N5095 server (Ubuntu 24.04, 7.5GB RAM, 98GB disk).

## Architecture
- **Dashboard**: Next.js 16 + shadcn/ui app at `/dashboard/` — the homelab command center
- **LinkedIn Command Center**: AI-powered content system at `/dashboard/src/app/linkedin/` — generates daily LinkedIn drafts via Claude CLI, with voice profile learning
- **Caddy**: Reverse proxy config at `/caddy/Caddyfile` — serves dashboard on :80
- **Docker Compose**: Root `docker-compose.yml` orchestrates the dashboard container
- **Submodules**: Individual service repos (tubepod) linked as git submodules

## Server Details
- **Host**: 192.168.1.142 (LAN) / 100.97.53.99 (Tailscale)
- **SSH**: `ssh homelab-claude` (user: claude) — if LAN unreachable, use Tailscale: `ssh -i ~/.ssh/id_ed25519 claude@100.97.53.99`
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
- `/home/claude/homelab-data/linkedin/` — LinkedIn Command Center data (SQLite DB + voice profile)
- `/home/claude/.claude/` — Claude CLI credentials (mounted into dashboard container)
- `/home/claude/tubepod/` — TubePod service
- `/home/claude/openclaw/` — OpenClaw service

## LinkedIn Command Center
AI-powered system that generates daily LinkedIn post drafts about AI, AI in finance, and AI for programming.

### How it works
1. System cron (7am daily) calls `POST /api/linkedin/runs` to trigger generation
2. Claude CLI runs headless inside the container, does WebSearch, generates 7 drafts
3. David reviews drafts at `/linkedin`, clicks one to see detail + sources
4. "Copiar contexto para Claude" copies draft + voice profile + context to clipboard
5. David refines in a separate Claude chat, publishes manually on LinkedIn
6. David pastes the final version back at `/linkedin/published` to feed the learning loop
7. Voice profile (`voice-profile.md`) updates automatically after each publish

### Key files
- `dashboard/prompts/` — Claude prompt templates (generate-drafts, process-episode, update-voice-profile, refine-chat)
- `dashboard/scripts/` — Node scripts that spawn Claude CLI (.mjs)
- `dashboard/src/app/linkedin/` — 6 pages (drafts, detail, published, sources, episodes, voice)
- `dashboard/src/app/api/linkedin/` — API routes
- `dashboard/src/lib/db/` — Drizzle ORM schema + SQLite client
- `dashboard/src/lib/linkedin/` — helpers (claude-runner, rss, whisper, paths, types, spawn-script)

### Environment variables (in docker-compose.yml)
- `LINKEDIN_DB_PATH` — path to SQLite database inside container
- `VOICE_PROFILE_PATH` — path to voice-profile.md inside container
- `LINKEDIN_SCRIPTS_DIR` — path to scripts directory
- `LINKEDIN_PROMPTS_DIR` — path to prompts directory
- `OPENAI_API_KEY` — for Whisper transcription (podcast episodes)
- `CRON_SECRET` — protects the runs endpoint from unauthorized triggers

### Docker volumes for LinkedIn
- `/home/claude/homelab-data/linkedin:/app/data` — persistent DB + voice profile
- `/home/claude/.claude:/home/nextjs/.claude` — Claude CLI credentials (rw, for token refresh)
- `/home/claude/.claude.json:/home/nextjs/.claude.json` — Claude CLI config

### Setup guide
See `homelab-setup/linkedin-setup.md` for first-time setup instructions.

## Development
```bash
cd dashboard && npm run dev    # Local dev server on :3000
cd dashboard && npm test       # Run Vitest tests
cd dashboard && npm run build  # Production build
```

## Deployment
```bash
ssh homelab-claude "cd ~/homelab && git pull && docker compose up -d --build"
```
If LAN unreachable, use Tailscale:
```bash
ssh -i ~/.ssh/id_ed25519 claude@100.97.53.99 "cd ~/homelab && git pull && docker compose up -d --build"
```

## Rules
- NEVER modify /home/claude/vault/ — it's synced across devices
- NEVER delete running containers without explicit request
- Dashboard mounts vault as READ ONLY
- Dashboard mounts Docker socket as READ ONLY
- Dashboard mounts Claude credentials as READ-WRITE (needed for token refresh)
- LinkedIn generation runs can take 30-40 minutes on the Celeron — don't kill prematurely
