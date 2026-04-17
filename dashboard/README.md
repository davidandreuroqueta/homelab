# Homelab Dashboard

Next.js 16 + shadcn/ui dashboard for managing the homelab server.

## Sections

| Route | Description |
|-------|-------------|
| `/` | Overview dashboard with system widgets |
| `/services` | Service catalog with health checks |
| `/docker` | Container management with log viewer |
| `/vault` | Obsidian knowledge base browser |
| `/linkedin` | LinkedIn Command Center — AI draft generation |
| `/linkedin/published` | Published posts history + registration form |
| `/linkedin/sources` | RSS feeds and podcast source management |
| `/linkedin/episodes` | Podcast episode list + transcription trigger |
| `/linkedin/voice` | Voice profile viewer/editor |
| `/system` | System monitoring (CPU, memory, disk, network) |

## Tech stack

- **Next.js 16** (App Router, RSC-first) + **React 19**
- **shadcn/ui** + **Tailwind CSS v4** (dark mode only)
- **SQLite** via **Drizzle ORM** + **better-sqlite3**
- **Claude CLI** (headless, for draft generation and voice profile updates)
- **OpenAI Whisper API** (for podcast transcription)
- **Vitest** for tests

## Development

```bash
npm run dev       # Dev server on :3000
npm test          # Run tests
npm run build     # Production build
npm run db:push   # Apply schema changes to DB
npm run db:seed   # Seed default sources
```

## Deployment

Deployed via Docker Compose from the repo root. See `homelab-setup/linkedin-setup.md` for first-time setup.
