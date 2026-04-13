import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(), // 'rss' | 'podcast' | 'web_topic'
  name: text('name').notNull(),
  url: text('url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(5),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  podcastSourceId: integer('podcast_source_id').notNull().references(() => sources.id),
  guid: text('guid').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  audioUrl: text('audio_url').notNull(),
  durationSeconds: integer('duration_seconds'),
  publishedAt: integer('published_at').notNull(),
  transcript: text('transcript'),
  status: text('status').notNull().default('available'), // 'available' | 'processing' | 'transcribed' | 'drafted' | 'failed'
  transcribedAt: integer('transcribed_at'),
  error: text('error'),
});

export const generationRuns = sqliteTable('generation_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredAt: integer('triggered_at').notNull().default(sql`(unixepoch())`),
  triggeredBy: text('triggered_by').notNull(), // 'cron' | 'manual' | 'episode:{id}'
  status: text('status').notNull().default('running'), // 'running' | 'success' | 'error'
  claudeOutputLog: text('claude_output_log'),
  draftsGeneratedCount: integer('drafts_generated_count').notNull().default(0),
  durationMs: integer('duration_ms'),
  error: text('error'),
});

export const published = sqliteTable('published', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id'),
  content: text('content').notNull(),
  linkedinUrl: text('linkedin_url').notNull(),
  publishedAt: integer('published_at').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

export const drafts = sqliteTable('drafts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batchId: text('batch_id').notNull(),
  runId: integer('run_id').references(() => generationRuns.id),
  generatedAt: integer('generated_at').notNull().default(sql`(unixepoch())`),
  topic: text('topic').notNull(),
  angle: text('angle').notNull(),
  isStarPost: integer('is_star_post', { mode: 'boolean' }).notNull().default(false),
  content: text('content').notNull(),
  hook: text('hook').notNull(),
  sources: text('sources').notNull().default('[]'), // JSON
  status: text('status').notNull().default('pending'), // 'pending' | 'discarded' | 'published' | 'iterating'
  publishedId: integer('published_id').references(() => published.id),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id').notNull().references(() => drafts.id),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

export const voiceProfileUpdates = sqliteTable('voice_profile_updates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredByPublishedId: integer('triggered_by_published_id').references(() => published.id),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  summary: text('summary'), // Short note from Claude about what changed
});

// Relations
export const draftsRelations = relations(drafts, ({ many, one }) => ({
  chatMessages: many(chatMessages),
  run: one(generationRuns, {
    fields: [drafts.runId],
    references: [generationRuns.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  draft: one(drafts, {
    fields: [chatMessages.draftId],
    references: [drafts.id],
  }),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  source: one(sources, {
    fields: [episodes.podcastSourceId],
    references: [sources.id],
  }),
}));

// Exported types
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type Published = typeof published.$inferSelect;
export type NewPublished = typeof published.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type NewEpisode = typeof episodes.$inferInsert;
export type GenerationRun = typeof generationRuns.$inferSelect;
export type NewGenerationRun = typeof generationRuns.$inferInsert;
