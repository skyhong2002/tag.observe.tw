CREATE TABLE `article_tags` (
	`article_id` bigint NOT NULL,
	`tag` varchar(60) NOT NULL,
	`published_at` datetime NOT NULL,
	CONSTRAINT `article_tag` UNIQUE(`article_id`,`tag`)
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`media` varchar(32) NOT NULL,
	`media_id` int NOT NULL,
	`published_at` datetime NOT NULL,
	`crawled_at` datetime NOT NULL,
	`url` varchar(512) NOT NULL,
	`title` varchar(512) NOT NULL,
	`image` varchar(512),
	`tags` json NOT NULL,
	`description` text,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_media_id` UNIQUE(`media`,`media_id`)
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(40) NOT NULL,
	`started_at` datetime NOT NULL,
	`finished_at` datetime,
	`status` varchar(12) NOT NULL,
	`detail` text,
	CONSTRAINT `job_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ranking_entries` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`snapshot_id` int NOT NULL,
	`rank` int NOT NULL,
	`tag` varchar(60) NOT NULL,
	`score_micro` int NOT NULL,
	`count` int NOT NULL,
	`media` json NOT NULL,
	CONSTRAINT `ranking_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ranking_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(15) NOT NULL,
	`hour_start` datetime NOT NULL,
	`computed_at` datetime NOT NULL,
	`hours` int NOT NULL,
	`weight` int NOT NULL,
	`media_count` int NOT NULL,
	`article_count` int NOT NULL,
	`duration_ms` int NOT NULL,
	`chart` longtext NOT NULL,
	CONSTRAINT `ranking_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `ranking_category_hour` UNIQUE(`category`,`hour_start`)
);
--> statement-breakpoint
CREATE INDEX `tag_published` ON `article_tags` (`tag`,`published_at`);--> statement-breakpoint
CREATE INDEX `articles_published` ON `articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `articles_media_published` ON `articles` (`media`,`published_at`);--> statement-breakpoint
CREATE INDEX `job_runs_name` ON `job_runs` (`name`,`started_at`);--> statement-breakpoint
CREATE INDEX `entries_snapshot` ON `ranking_entries` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE INDEX `entries_tag` ON `ranking_entries` (`tag`,`snapshot_id`);--> statement-breakpoint
CREATE INDEX `ranking_hour` ON `ranking_snapshots` (`hour_start`);