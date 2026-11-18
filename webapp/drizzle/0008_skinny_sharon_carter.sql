CREATE TABLE `machine_units` (
	`machine_token` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`registration_key` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `machine_owner_equipment` ON `machine_units` (`owner_id`,`equipment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `machine_registration_key` ON `machine_units` (`owner_id`,`registration_key`);--> statement-breakpoint
CREATE TABLE `recipe_manifests` (
	`owner_id` text NOT NULL,
	`recipe_token` text NOT NULL,
	`manifest_text` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `recipe_token`)
);
