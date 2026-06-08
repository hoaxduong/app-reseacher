CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`package_name` text,
	`source_type` text NOT NULL,
	`apk_pure_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_artifact_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_package_name_unique` ON `apps` (`package_name`);--> statement-breakpoint
CREATE TABLE `apk_artifacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`original_filename` text NOT NULL,
	`stored_path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`source` text NOT NULL,
	`md5` text NOT NULL,
	`sha1` text NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apk_artifacts_sha256_unique` ON `apk_artifacts` (`sha256`);--> statement-breakpoint
CREATE INDEX `apk_artifacts_app_idx` ON `apk_artifacts` (`app_id`);--> statement-breakpoint
CREATE TABLE `analysis_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`artifact_id` integer,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration_ms` integer,
	`tool_versions` text,
	`error_json` text,
	`summary_json` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artifact_id`) REFERENCES `apk_artifacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `analysis_runs_app_idx` ON `analysis_runs` (`app_id`);--> statement-breakpoint
CREATE INDEX `analysis_runs_artifact_idx` ON `analysis_runs` (`artifact_id`);--> statement-breakpoint
CREATE TABLE `app_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`artifact_id` integer,
	`run_id` integer NOT NULL,
	`version_name` text,
	`version_code` text,
	`min_sdk` text,
	`target_sdk` text,
	`compile_sdk` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artifact_id`) REFERENCES `apk_artifacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`protection_level` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_sdks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`name` text NOT NULL,
	`evidence` text NOT NULL,
	`confidence` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`value` text,
	`path` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_strings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`value` text NOT NULL,
	`source` text NOT NULL,
	`locale` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_certificates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`subject` text,
	`issuer` text,
	`serial_number` text,
	`valid_from` text,
	`valid_to` text,
	`sha1` text,
	`sha256` text,
	`pem` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_components` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`exported` text,
	`permission` text,
	`intent_filters_json` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`path` text NOT NULL,
	`kind` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`compressed_size_bytes` integer NOT NULL,
	`sha256` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_icons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`path` text NOT NULL,
	`stored_path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`density` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_screenshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`source_url` text,
	`stored_path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
