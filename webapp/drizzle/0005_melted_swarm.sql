CREATE TABLE `research_files` (
	`file_id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`media_type` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_file_record` ON `research_files` (`record_id`);--> statement-breakpoint
CREATE TABLE `research_grants` (
	`space_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`space_id`, `email`)
);
--> statement-breakpoint
CREATE INDEX `research_grant_email` ON `research_grants` (`email`);--> statement-breakpoint
CREATE TABLE `research_ingestions` (
	`owner_id` text NOT NULL,
	`ingest_key` text NOT NULL,
	`record_id` text NOT NULL,
	`request_digest` text NOT NULL,
	PRIMARY KEY(`owner_id`, `ingest_key`)
);
--> statement-breakpoint
CREATE TABLE `research_records` (
	`record_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`space_id` text NOT NULL,
	`kind` text NOT NULL,
	`container_id` text NOT NULL,
	`code` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`access_scope` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_owner` ON `research_records` (`owner_id`);--> statement-breakpoint
CREATE INDEX `research_space` ON `research_records` (`space_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `research_container_code` ON `research_records` (`owner_id`,`container_id`,`kind`,`code`);--> statement-breakpoint
CREATE TABLE `research_versions` (
	`record_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`record_id`, `revision`)
);
