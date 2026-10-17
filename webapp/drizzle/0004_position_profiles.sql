CREATE TABLE `position_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`revision` integer NOT NULL,
	`changes_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `position_profile_edits` (
	`equipment_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL
);
