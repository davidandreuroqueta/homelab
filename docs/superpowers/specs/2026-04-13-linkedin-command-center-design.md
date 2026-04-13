# LinkedIn Command Center — Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Author:** David Andreu Roqueta (with Claude)

## Purpose

Build an AI-powered content management system integrated into the existing homelab
Next.js dashboard. The system helps David publish 3 LinkedIn posts per week about
AI and AI-in-finance topics by:

1. Automatically generating 5 draft posts every morning at 7am.
2. Allowing David to refine drafts via in-dashboard chat with Claude.
3. Learning David's writing style over time from posts he publishes.
4. Letting David manually process specific podcast episodes (The AI Daily Brief)
   into post drafts.
5. Tracking what's been published to avoid repetition.

David publishes manually on LinkedIn. He pastes the final published version back
into the dashboard to feed the learning loop.

## Key Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Storage | SQLite + Drizzle ORM |
| 2 | Podcast processing | Manual episode selection + OpenAI Whisper API |
| 3 | Draft generation | `claude` CLI headless with subscription OAuth (`claude setup-token`) |
| 4 | Cadence | Daily at 7:00 via system cron on homelab |
| 5 | Drafts per run | 5 drafts, hybrid mix (star post + 2 alt angles + 2 secondary topics) |
| 6 | UI structure | Multi-page Next.js sub-routes under `/linkedin` |
| 7 | Draft refinement | In-dashboard chat spawning `claude` CLI per message (stateless turn) |
| 8 | Voice profile | Markdown file (`voice-profile.md`) updated by Claude after each publish |
| 9 | Publication tracking | Manual paste of text + LinkedIn URL |
| 10 | Research scope | RSS feeds + Claude's built-in WebSearch tool |
| 11 | Manual research trigger | Button on `/linkedin` to run generation on-demand outside cron |

## Out of Scope (v1)

- Automatic publishing to LinkedIn (user publishes manually)
- Auto-extraction of post text from LinkedIn URL (requires Chromium, not worth it)
- LinkedIn metrics tracking (likes, comments, impressions)
- Authentication on the dashboard (LAN/Tailscale only for now)
- Image or carousel generation (text only in v1)
- Notifications (email/Telegram) when drafts are ready
- Fine-tuning or multi-account support

## Architecture

### High-level flow

```
┌───────────────────────────── HOMELAB (Celeron N5095) ──────────────────────────────┐
│                                                                                     │
│  ┌──────────────┐    ┌────────────────────────────────┐                            │
│  │ cron (host)  │    │  Dashboard (Next.js 16, Docker) │                            │
│  │  7am daily   │    │                                 │                            │
│  │  generate.sh │    │  Pages:  /linkedin/*            │                            │
│  └──────┬───────┘    │  APIs:   /api/linkedin/*        │                            │
│         │            │                                 │                            │
│         │ spawns     │  ┌───────────────────────────┐  │                            │
│         ▼            │  │ Manual trigger button     │──┼─► spawn generate-drafts.sh │
│  ┌──────────────┐    │  │ (/linkedin "Regenerar")   │  │                            │
│  │ claude CLI   │    │  └───────────────────────────┘  │                            │
│  │ headless     │◄───┤  ┌───────────────────────────┐  │                            │
│  │ WebSearch    │    │  │ Chat API                  │──┼─► spawn claude CLI /turn  │
│  │ + RSS + DB   │    │  │ (/api/drafts/:id/chat)    │  │                            │
│  └──────┬───────┘    │  └───────────────────────────┘  │                            │
│         │            │  ┌───────────────────────────┐  │                            │
│         ▼            │  │ Published API             │──┼─► spawn update-voice.sh   │
│  ┌──────────────┐◄───┤  │ (/api/published POST)     │  │                            │
│  │ SQLite +     │    │  └───────────────────────────┘  │                            │
│  │ voice.md     │    │  ┌───────────────────────────┐  │                            │
│  └──────────────┘    │  │ Episode API               │──┼─► spawn process-episode.sh│
│                      │  │ (/api/episodes/:id/proc.) │  │                            │
│                      │  └───────────────────────────┘  │                            │
│                      └─────────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Components

**1. Dashboard** — Next.js 16 app, already running in Docker. Gets new `/linkedin`
section with 5 sub-routes and 5+ API routes.

**2. SQLite database** — Single file at `/app/data/linkedin.db`, mounted as volume
from host. Drizzle ORM for typed access.

**3. Voice profile** — Markdown file at `/app/data/voice-profile.md`, also mounted
as volume. Editable by Claude (via `update-voice-profile.sh`) and by David manually
via dashboard.

**4. Scripts** — Three bash wrappers in `/home/claude/homelab/scripts/`:
   - `generate-drafts.sh` — cron + manual trigger, main daily workflow
   - `process-episode.sh` — on-demand from dashboard, transcribes + drafts
   - `update-voice-profile.sh` — triggered after each publish registration

**5. Prompts** — Markdown files in `/home/claude/homelab/prompts/`, versioned in
git. Read by the scripts above.

**6. System cron** — Single entry on host as user `claude`:
```
0 7 * * * /home/claude/homelab/scripts/generate-drafts.sh
```

### Authentication for `claude` CLI

- Token generated via `claude setup-token` (1-year validity).
- Stored in `/home/claude/.claude-token` (mode 600).
- Exported as `CLAUDE_CODE_OAUTH_TOKEN` by scripts.
- `ANTHROPIC_API_KEY` NOT set in cron env (would override OAuth).
- Annual rotation reminder in David's calendar.

### Claude CLI flags (applied to all headless invocations)

```
claude -p \
  --output-format json \
  --permission-mode dontAsk \
  --allowedTools "<scoped per-script>" \
  --max-turns <N> \
  --no-session-persistence
```

Per-script tool allowlists:
- `generate-drafts.sh`: `Read,Write,Bash(sqlite3 *),WebSearch,WebFetch`
- `refine-chat` (invoked by API): `none` (text-only refinement)
- `update-voice-profile.sh`: `Read,Write`
- `process-episode.sh`: `Read,Write,Bash(sqlite3 *)`

### Version pinning

`claude` CLI version pinned to known-good release (≥2.1.81) to avoid auto-updates
breaking subscription OAuth (per Codex review: `--bare` may become `-p` default,
which wouldn't read OAuth).

## Data Model (Drizzle schema)

```typescript
// drafts
drafts {
  id: integer PK autoincrement
  batchId: text (uuid)          // Groups the 5 drafts of one run
  generatedAt: integer (unix ts)
  topic: text                    // "IA generativa en banca"
  angle: text                    // "technical" | "opinion" | "news-summary" | "personal"
  isStarPost: integer (boolean)
  content: text                  // Full post text (max ~3000 chars)
  hook: text                     // First line, for card preview
  sources: text (json)           // [{type, url, title}]
  status: text                   // "pending" | "discarded" | "published" | "iterating"
  publishedId: integer FK(published.id) nullable
}

// published
published {
  id: integer PK autoincrement
  draftId: integer FK(drafts.id) nullable
  content: text                  // Final version pasted by David
  linkedinUrl: text
  publishedAt: integer (unix ts) // When David published on LinkedIn
  createdAt: integer (unix ts)   // When this record was created
}

// chat_messages
chat_messages {
  id: integer PK autoincrement
  draftId: integer FK(drafts.id)
  role: text                     // "user" | "assistant"
  content: text
  createdAt: integer (unix ts)
}

// sources
sources {
  id: integer PK autoincrement
  kind: text                     // "rss" | "podcast" | "web_topic"
  name: text
  url: text                      // RSS URL or topic keyword
  enabled: integer (boolean)
  priority: integer              // 1-10
  createdAt: integer (unix ts)
}

// episodes
episodes {
  id: integer PK autoincrement
  podcastSourceId: integer FK(sources.id)
  guid: text UNIQUE              // Item GUID from RSS
  title: text
  description: text
  audioUrl: text
  durationSeconds: integer nullable
  publishedAt: integer (unix ts)
  transcript: text nullable      // Null until processed
  status: text                   // "available" | "processing" | "transcribed" | "drafted" | "failed"
  transcribedAt: integer nullable
  error: text nullable
}

// generation_runs — audit log
generation_runs {
  id: integer PK autoincrement
  triggeredAt: integer (unix ts)
  triggeredBy: text              // "cron" | "manual" | "episode:{id}"
  status: text                   // "running" | "success" | "error"
  claudeOutputLog: text nullable // Truncated output from CLI
  draftsGeneratedCount: integer
  durationMs: integer nullable
  error: text nullable
}
```

### Initial seed

Sources table seeded at migration time with a curated list:

| Name | Kind | URL | Priority |
|------|------|-----|----------|
| The Batch | rss | https://www.deeplearning.ai/the-batch/feed/ | 9 |
| Import AI | rss | https://importai.substack.com/feed | 9 |
| Latent Space | rss | https://api.substack.com/feed/podcast/1084089.rss | 8 |
| Ahead of AI | rss | https://magazine.sebastianraschka.com/feed | 8 |
| Ben's Bites | rss | https://bensbites.beehiiv.com/feed | 7 |
| TLDR AI | rss | https://tldr.tech/ai/rss | 7 |
| Emerj (AI Business) | rss | https://emerj.com/feed/ | 8 |
| Finextra | rss | https://www.finextra.com/rss/headlines.aspx | 7 |
| arXiv cs.LG | rss | http://export.arxiv.org/rss/cs.LG | 6 |
| arXiv q-fin | rss | http://export.arxiv.org/rss/q-fin | 6 |
| Hacker News AI | rss | https://hnrss.org/newest?q=AI+OR+artificial+intelligence | 6 |
| Papers with Code | rss | https://paperswithcode.com/latest/feed | 5 |
| The AI Daily Brief | podcast | (RSS URL to resolve from Apple Podcasts) | 10 |

## User-facing pages

### `/linkedin` — Today's drafts

- Header: date + "Regenerar drafts ahora" button (manual trigger)
- Grid of 5 draft cards (2 cols desktop, 1 col mobile)
- Each card shows: hook, truncated body, topic + angle badges, sources count,
  age (e.g., "Hace 3 horas")
- Card actions: "Ver / Refinar" (→ detail page), "Descartar"
- Empty state: "No hay drafts hoy. Pulsa Regenerar para lanzar investigación."
- Loading state when generation is running: spinner + "Claude está investigando..."
  (polls `/api/linkedin/runs/:id` for status)

### `/linkedin/drafts/[id]` — Draft detail + chat

- Left panel: draft content (editable textarea), metadata (sources list with links),
  char count
- Right panel: chat with Claude
  - History of messages persisted in `chat_messages`
  - Input at bottom, send button
  - Each send → spawns claude CLI, stateless turn with full history in prompt
  - Loading state during the 15-30s response time
- Footer actions:
  - "Marcar como publicado" → modal: paste final content + URL, saves to `published`,
    updates draft.status, triggers voice profile update
  - "Descartar draft" → sets status to discarded

### `/linkedin/published` — Publication history

- Form at top: textarea for content + input for LinkedIn URL + "Guardar"
- On save: inserts into `published`, triggers `update-voice-profile.sh` in background,
  optional link to the originating draft (dropdown to pick unlinked drafts from today)
- Table below: chronological list (newest first) with content preview, URL link,
  publishedAt, link to originating draft if any

### `/linkedin/episodes` — Podcast episodes

- Auto-refresh from The AI Daily Brief RSS every 6 hours (background cron or
  on-page-load with revalidation)
- List of episodes (newest first): title, description, duration, publishedAt, status
- Status badges: "Disponible" / "Transcribiendo..." / "Transcrito" / "Con drafts"
- Action button per episode: "Procesar a drafts" (disabled if already processed)
  - On click: calls `/api/linkedin/episodes/:id/process` which spawns
    `process-episode.sh` in background
  - Status updates in real-time (polling every 5s while processing)

### `/linkedin/sources` — Sources management

- Table: name, kind, URL (truncated), priority, enabled toggle, "Eliminar" button
- Form at bottom: add new source (kind select, name, URL, priority slider)
- All changes persist immediately to SQLite

### `/linkedin/voice` — Voice profile viewer + editor

- Markdown render of current `voice-profile.md`
- "Editar" button → replaces render with textarea
- "Guardar" / "Cancelar" buttons
- Timeline below: last 10 updates to the profile (timestamp + originating post if any)
  - Requires storing an update log — simple table or git history of the file

## API Routes

```
GET    /api/linkedin/drafts                   List today's drafts
GET    /api/linkedin/drafts/:id                Get single draft
PATCH  /api/linkedin/drafts/:id                Update content / status
DELETE /api/linkedin/drafts/:id                Discard draft
GET    /api/linkedin/drafts/:id/chat           Get chat history
POST   /api/linkedin/drafts/:id/chat           Send message, spawn Claude

GET    /api/linkedin/published                 List published posts
POST   /api/linkedin/published                 Register published post + trigger voice update

GET    /api/linkedin/episodes                  List episodes (with RSS refresh)
POST   /api/linkedin/episodes/:id/process      Trigger transcription + drafts
GET    /api/linkedin/episodes/:id              Episode detail with transcript

GET    /api/linkedin/sources                   List sources
POST   /api/linkedin/sources                   Add source
PATCH  /api/linkedin/sources/:id               Update source
DELETE /api/linkedin/sources/:id               Remove source

GET    /api/linkedin/voice                     Get voice profile markdown
PUT    /api/linkedin/voice                     Replace voice profile (manual edit)

POST   /api/linkedin/runs                      Trigger manual generation (button)
GET    /api/linkedin/runs/:id                  Poll run status
GET    /api/linkedin/runs                      List recent runs (audit)
```

### Spawning scripts from API routes

Scripts are invoked with `child_process.spawn` in detached + unref mode for the
ones that run long (process-episode, generate-drafts). The API returns a `runId`
immediately, the client polls status.

For the chat endpoint, the call is synchronous (awaited) because the UX expects
the response in the same request. Connection timeout set to 60s.

The dashboard container needs:
- Mount of the scripts directory (`/home/claude/homelab/scripts:/scripts:ro`)
- Mount of the prompts directory (`/home/claude/homelab/prompts:/prompts:ro`)
- `CLAUDE_CODE_OAUTH_TOKEN` env var
- `OPENAI_API_KEY` env var (for Whisper)
- The `claude` CLI available in the container — either mount host binary or
  install in image

**Decision: install `claude` CLI inside the Docker image** with a pinned version
(≥2.1.81). This avoids host-container version drift. We can update via rebuilding
the image on demand.

## Prompts (spec level)

### `generate-drafts.md`

Given access to SQLite, Web tools, and filesystem, Claude:
1. Reads `sources` table (enabled RSS feeds sorted by priority)
2. Fetches each RSS feed (WebFetch) and extracts items from last 3 days
3. Reads recent `published` posts (last 30) and recent `drafts` (last 7 days) to
   understand topic coverage
4. Performs 3-5 WebSearch queries on AI + finance trends NOT covered by RSS
5. Reads `voice-profile.md`
6. Selects the "star topic" — most impactful news of the day
7. Writes 5 drafts to `drafts` table:
   - Draft 1 (star): full post on star topic, best angle
   - Drafts 2-3: alternative angles on star topic (technical / opinion)
   - Drafts 4-5: two secondary topics with one angle each
8. All drafts share the same `batchId` (UUID generated at start)
9. Inserts a `generation_runs` record with status + count + duration
10. Output format: JSON summary for logging

### `refine-chat.md`

Given:
- Current draft content
- Voice profile
- Last 5 published posts (for style consistency)
- Chat history
- New user message

Claude produces the assistant's next reply. Single turn, no tools. Text-only.

### `update-voice-profile.md`

Given:
- Current `voice-profile.md`
- A newly published post (content)
- Last 5 published posts (for context)

Claude produces the new `voice-profile.md` with:
- Only additions/refinements based on patterns observed in the new post
- Strict length ceiling (~1000 words)
- Preserve existing structure and wording where it still applies

### `process-episode.md`

Given:
- Transcript of an episode (from Whisper)
- Voice profile
- Recent published topics

Claude generates 3 drafts based on reflections from the episode. Each draft marked
with `sources` pointing to the episode. Stored in `drafts` table under a new
`batchId`.

## Non-goals / edge cases

- If `generate-drafts.sh` is already running (flock), the cron skips this run.
  Next opportunity is next day. Acceptable.
- If an episode is >25MB (Whisper limit), split with ffmpeg and concatenate
  transcripts. If ffmpeg not available or split fails, mark episode as failed with
  error message.
- If `claude` CLI returns non-zero exit code, run marked as error, full stderr
  stored in `generation_runs.error` (truncated to 4KB).
- Database migrations: run via `drizzle-kit push` on container start (idempotent).
  Initial seed only runs if sources table is empty.
- Dashboard container has no network access restrictions — trusts the `claude`
  CLI's tool allowlist to prevent misuse.

## Cost estimate

| Component | Monthly cost |
|-----------|--------------|
| Claude Max subscription | $0 additional (already have it) |
| OpenAI Whisper API (episode processing) | ~$2-3 (2-3 episodes/week) |
| LinkedIn API | $0 (not used) |
| Infrastructure | $0 (existing homelab) |
| **Total** | **~$2-3/month** |

## Risks

1. **`claude -p` behavior changes**: Anthropic moving `-p` toward `--bare` default,
   which doesn't read OAuth. Mitigation: pin CLI version, monitor changelogs.
2. **OAuth token expiry**: 1-year validity. Mitigation: calendar reminder for
   annual rotation, error alerting via logs.
3. **RSS feed changes/outages**: Mitigation: Claude gracefully skips failed feeds,
   continues with what's available. Logged in `generation_runs`.
4. **Whisper API 25MB limit**: Mitigation: ffmpeg split for long episodes.
5. **Voice profile drift**: The profile could accumulate noise over time.
   Mitigation: manual editing via `/linkedin/voice`, 1000-word cap in prompt.

## Success criteria

- David opens dashboard in the morning and has 5 drafts to review.
- David can refine a draft via chat and publish a version he's proud of.
- After pasting a published post, the voice profile updates automatically.
- Over 4-6 weeks, drafts become noticeably more aligned with David's voice.
- Zero manual intervention required for the cron to keep running.
