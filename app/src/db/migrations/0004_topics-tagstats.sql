CREATE TABLE `tag_stats` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tag` varchar(60) NOT NULL,
	`category` varchar(15) NOT NULL,
	`level` int NOT NULL,
	`first_hour` datetime NOT NULL,
	`last_hour` datetime NOT NULL,
	`hours_count` int NOT NULL,
	`max_hour` datetime NOT NULL,
	`max_count` int NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `tag_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `tag_stats_key` UNIQUE(`tag`,`category`,`level`)
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`media` varchar(32) NOT NULL,
	`url` varchar(512) NOT NULL,
	`title` varchar(512) NOT NULL,
	`image` varchar(512),
	`category` varchar(64),
	`first_seen` datetime NOT NULL,
	`last_seen` datetime NOT NULL,
	CONSTRAINT `topics_id` PRIMARY KEY(`id`),
	CONSTRAINT `topics_media_url` UNIQUE(`media`,`url`)
);
--> statement-breakpoint
CREATE INDEX `tag_stats_last` ON `tag_stats` (`category`,`level`,`last_hour`);--> statement-breakpoint
CREATE INDEX `topics_media_seen` ON `topics` (`media`,`first_seen`);