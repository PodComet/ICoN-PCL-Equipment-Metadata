CREATE TABLE `admin_unlock_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_started` integer NOT NULL,
	`attempts` integer NOT NULL
);
