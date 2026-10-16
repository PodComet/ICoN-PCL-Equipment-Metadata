CREATE TABLE `process_workflow_versions` (
	`workflow_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`workflow_id`, `revision`)
);
--> statement-breakpoint
CREATE TABLE `process_workflows` (
	`workflow_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`route_id` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
