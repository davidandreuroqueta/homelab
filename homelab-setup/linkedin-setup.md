# LinkedIn Command Center — One-time Setup on Homelab

Run these steps on the homelab server (`ssh homelab-claude`).

## 1. Generate Claude Code OAuth token

On your local machine (where you're logged in to Claude Max):
```
claude setup-token
```
Copy the token output.

## 2. Set up env file on homelab

```
mkdir -p ~/homelab-data/linkedin
cat > ~/homelab/.env <<EOF
CLAUDE_CODE_OAUTH_TOKEN=<paste token here>
OPENAI_API_KEY=<your openai key, for whisper>
CRON_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 ~/homelab/.env
```

## 3. Initialize DB directory

```
mkdir -p ~/homelab-data/linkedin
touch ~/homelab-data/linkedin/voice-profile.md
```

## 4. Build + deploy

```
cd ~/homelab
git pull
docker compose up -d --build
```

The entrypoint will automatically run DB migrations on first start.

## 5. Seed default sources

```
curl -X POST -H "X-Cron-Secret: $(grep CRON_SECRET ~/homelab/.env | cut -d= -f2)" http://localhost:3000/api/linkedin/setup/seed
```

## 6. Install cron entry

Edit crontab (`crontab -e`) for user `claude`:
```
# LinkedIn drafts — daily 7am
0 7 * * * curl -fsS -X POST -H "X-Cron-Secret: $(grep CRON_SECRET ~/homelab/.env | cut -d= -f2)" http://localhost:3000/api/linkedin/runs > /home/claude/homelab/logs/linkedin-cron.log 2>&1
```

Ensure the logs dir exists:
```
mkdir -p ~/homelab/logs
```

## 7. Verify

- Open `http://homelab:3000/linkedin` in a browser (or Tailscale)
- Should see "No hay drafts recientes" with a "Regenerar drafts" button
- Click button -> should show "Claude investigando..." spinner -> drafts appear after a few minutes

## 8. Token rotation (yearly)

Add to calendar: `claude setup-token` again, update `~/homelab/.env`, restart:
```
docker compose restart dashboard
```
