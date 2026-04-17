# LinkedIn Command Center — Setup Guide

## Prerequisites
- Claude CLI logged in on the homelab host (`claude` user must have valid session in `~/.claude/`)
- OpenAI API key (for Whisper podcast transcription — optional, only needed for episodes feature)

## First-time setup

Run these steps on the homelab server.

### 1. Create data directory and env file

```bash
mkdir -p ~/homelab-data/linkedin ~/homelab/logs

cat > ~/homelab/.env <<EOF
OPENAI_API_KEY=<your openai key, for whisper — leave empty if not using episodes>
CRON_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 ~/homelab/.env
```

### 2. Ensure Claude CLI is authenticated

The dashboard container mounts the host's `~/.claude/` and `~/.claude.json` to reuse
the host's Claude session. Verify it's valid:

```bash
claude --version  # should show a version
claude auth status  # should show authenticated
```

If not logged in, run `claude` interactively and complete the login flow.

Note: OAuth tokens expire every few hours. The CLI refreshes them automatically,
which is why the credentials are mounted read-write into the container.

### 3. Build and deploy

```bash
cd ~/homelab
git pull
docker compose up -d --build
```

The entrypoint automatically runs SQLite migrations on startup.

### 4. Seed default sources

```bash
source ~/homelab/.env
curl -X POST -H "X-Cron-Secret: $CRON_SECRET" http://localhost:3000/api/linkedin/setup/seed
```

Expected: `{"inserted":13}` (12 RSS feeds + 1 podcast).

### 5. Install daily cron

```bash
mkdir -p ~/homelab/logs
(crontab -l 2>/dev/null; echo '0 7 * * * source ~/homelab/.env && curl -fsS -X POST -H "X-Cron-Secret: $CRON_SECRET" http://localhost:3000/api/linkedin/runs >> ~/homelab/logs/linkedin-cron.log 2>&1') | crontab -
```

### 6. Verify

- Open `http://homelab:3000/linkedin` (or via Tailscale IP)
- Should see "No hay drafts recientes" with a "Regenerar drafts" button
- Click the button — Claude will research and generate drafts (takes 30-40 min on Celeron N5095)
- Drafts appear on the page when done

## Daily usage

1. **Morning**: open `/linkedin` — 7 drafts ready (generated at 7am by cron)
2. **Pick one**: click a draft to see full content + sources
3. **Verify sources**: click source links to fact-check
4. **Refine**: click "Copiar contexto para Claude" — paste into a new Claude chat to iterate
5. **Publish**: manually on LinkedIn
6. **Register**: paste the final text + LinkedIn URL at `/linkedin/published`
7. **Voice learns**: system automatically updates `voice-profile.md` after each registration

## Troubleshooting

### Drafts generation fails with 401
Claude CLI token has expired. SSH into the homelab, run `claude` interactively to
refresh the session, then try again.

### Generation takes too long (>40 min)
Normal on the Celeron N5095. The prompt does 5 web searches + generates 7 posts.
Check that the process is alive: `docker exec homelab-dashboard ps aux | grep claude`

### Episodes feature not working
Needs `OPENAI_API_KEY` set in `~/homelab/.env`. Restart container after adding:
`docker compose restart dashboard`

### Database issues
Migrations run automatically on container start. To check the DB:
```bash
docker exec homelab-dashboard sqlite3 /app/data/linkedin.db ".tables"
```

## Architecture notes

- **No CLAUDE_CODE_OAUTH_TOKEN env var** — credentials are mounted from host filesystem
- **No in-dashboard chat** — refinement happens in external Claude sessions via copy-paste
- **SQLite + Drizzle ORM** — single file DB at `/home/claude/homelab-data/linkedin/linkedin.db`
- **Prompts are versioned** in `dashboard/prompts/` — edit and redeploy to change behavior
