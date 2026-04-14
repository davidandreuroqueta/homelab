# Stage 1: Install ALL dependencies (including devDeps for build)
FROM node:22-alpine AS deps
WORKDIR /app
# build-base + python3 needed for better-sqlite3 native compilation
RUN apk add --no-cache build-base python3
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production (lean image)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# System deps: ffmpeg for audio chunking, bash for entrypoint
RUN apk add --no-cache ffmpeg bash

# Install claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy scripts and prompts for LinkedIn Command Center
COPY scripts ./scripts
COPY prompts ./prompts

# Copy migrations for runtime migration runner
COPY src/lib/db/migrations ./src/lib/db/migrations

# Copy runtime node_modules needed by entrypoint migration script
# (standalone output may not include these since they're used indirectly)
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/bindings ./node_modules/bindings
COPY --from=deps /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=deps /app/node_modules/prebuild-install ./node_modules/prebuild-install

# Entrypoint for migrations
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Ensure data dir exists (overridden by volume mount at runtime)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data /app/scripts /app/prompts /app/src

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
