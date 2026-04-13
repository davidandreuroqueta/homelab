CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` text NOT NULL,
	`run_id` integer,
	`generated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`topic` text NOT NULL,
	`angle` text NOT NULL,
	`is_star_post` integer DEFAULT false NOT NULL,
	`content` text NOT NULL,
	`hook` text NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`published_id` integer,
	FOREIGN KEY (`run_id`) REFERENCES `generation_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_id`) REFERENCES `published`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`podcast_source_id` integer NOT NULL,
	`guid` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`audio_url` text NOT NULL,
	`duration_seconds` integer,
	`published_at` integer NOT NULL,
	`transcript` text,
	`status` text DEFAULT 'available' NOT NULL,
	`transcribed_at` integer,
	`error` text,
	FOREIGN KEY (`podcast_source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_guid_unique` ON `episodes` (`guid`);--> statement-breakpoint
CREATE TABLE `generation_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`triggered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`triggered_by` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`claude_output_log` text,
	`drafts_generated_count` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `published` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer,
	`content` text NOT NULL,
	`linkedin_url` text NOT NULL,
	`published_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `voice_profile_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`triggered_by_published_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`summary` text,
	FOREIGN KEY (`triggered_by_published_id`) REFERENCES `published`(`id`) ON UPDATE no action ON DELETE no action
);
