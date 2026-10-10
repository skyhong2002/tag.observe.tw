CREATE TABLE `reader_history` (
	`user_id` int NOT NULL,
	`article_id` bigint NOT NULL,
	`read_at` datetime NOT NULL,
	CONSTRAINT `reader_history_user_id_article_id_pk` PRIMARY KEY(`user_id`,`article_id`)
);
--> statement-breakpoint
CREATE TABLE `reader_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`article_id` bigint NOT NULL,
	`kind` varchar(16) NOT NULL,
	`tags` json,
	`message` varchar(1000) NOT NULL,
	`status` varchar(10) NOT NULL DEFAULT 'open',
	`created_at` datetime NOT NULL,
	`resolved_at` datetime,
	`resolved_by` varchar(255),
	`resolution` varchar(255),
	CONSTRAINT `reader_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`key_hash` varchar(64) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`label` varchar(64) NOT NULL,
	`created_at` datetime NOT NULL,
	`last_used_at` datetime,
	`revoked_at` datetime,
	CONSTRAINT `user_api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_api_keys_hash` UNIQUE(`key_hash`)
);
--> statement-breakpoint
CREATE TABLE `user_feed_tokens` (
	`user_id` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `user_feed_tokens_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `user_feed_tokens_token` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user_follows` (
	`user_id` int NOT NULL,
	`kind` varchar(16) NOT NULL,
	`target` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `user_follows_user_id_kind_target_pk` PRIMARY KEY(`user_id`,`kind`,`target`)
);
--> statement-breakpoint
CREATE TABLE `user_prefs` (
	`user_id` int NOT NULL,
	`prefs` json NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `user_prefs_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_saves` (
	`user_id` int NOT NULL,
	`kind` varchar(8) NOT NULL,
	`target_id` bigint NOT NULL,
	`note` varchar(500),
	`created_at` datetime NOT NULL,
	CONSTRAINT `user_saves_user_id_kind_target_id_pk` PRIMARY KEY(`user_id`,`kind`,`target_id`)
);
--> statement-breakpoint
CREATE INDEX `reader_history_user_read` ON `reader_history` (`user_id`,`read_at`);--> statement-breakpoint
CREATE INDEX `reader_reports_status` ON `reader_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reader_reports_user` ON `reader_reports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_api_keys_user` ON `user_api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_saves_user_created` ON `user_saves` (`user_id`,`created_at`);