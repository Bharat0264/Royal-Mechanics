CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_subject` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'CUSTOMER' NOT NULL,
	`is_allowed` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_google_subject_unique` ON `app_users` (`google_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_app_users_role` ON `app_users` (`role`);--> statement-breakpoint
CREATE TABLE `local_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_hash` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_sessions_session_hash_unique` ON `local_sessions` (`session_hash`);--> statement-breakpoint
CREATE INDEX `idx_local_sessions_user_id` ON `local_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_local_sessions_expires_at` ON `local_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `mechanic_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`invited_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	FOREIGN KEY (`invited_by`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mechanic_invites_email_unique` ON `mechanic_invites` (`email`);