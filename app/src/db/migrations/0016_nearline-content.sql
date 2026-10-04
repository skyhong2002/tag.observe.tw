CREATE TABLE `article_archives` (
	`article_id` bigint NOT NULL,
	`content_hash` varchar(64) NOT NULL,
	`object_key` varchar(160) NOT NULL,
	`object_hash` varchar(64) NOT NULL,
	`archive_remote` varchar(512) NOT NULL,
	`archived_at` datetime NOT NULL,
	`verified_at` datetime NOT NULL,
	CONSTRAINT `article_archives_article_id_content_hash_pk` PRIMARY KEY(`article_id`,`content_hash`)
);
--> statement-breakpoint
CREATE TABLE `article_origins` (
	`source_key` varchar(512) NOT NULL,
	`raw_hash` varchar(64) NOT NULL,
	`article_id` bigint NOT NULL,
	`generation` varchar(64) NOT NULL,
	`source_object` varchar(512) NOT NULL,
	`adapter_version` varchar(64) NOT NULL,
	`linked_at` datetime NOT NULL,
	CONSTRAINT `article_origins_source_key_raw_hash_pk` PRIMARY KEY(`source_key`,`raw_hash`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD `content_accessed_at` datetime;--> statement-breakpoint
ALTER TABLE `articles` ADD `content_archive_hash` varchar(64);--> statement-breakpoint
CREATE INDEX `article_archives_verified` ON `article_archives` (`verified_at`);--> statement-breakpoint
CREATE INDEX `article_origins_article` ON `article_origins` (`article_id`);