CREATE TABLE `evidence_records` (
	`evidence_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`record_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_owner_created` ON `evidence_records` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `evidence_subject_revision` ON `evidence_records` (`subject_id`,`revision`);