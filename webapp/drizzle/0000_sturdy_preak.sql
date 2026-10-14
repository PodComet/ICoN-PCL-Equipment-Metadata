CREATE TABLE `equipment_edits` (
	`user_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `equipment_id`)
);
