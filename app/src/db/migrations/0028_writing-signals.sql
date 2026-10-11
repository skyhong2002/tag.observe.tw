CREATE TABLE `article_writing` (
	`article_id` bigint NOT NULL,
	`media` varchar(32) NOT NULL,
	`published_at` datetime NOT NULL,
	`day` date NOT NULL,
	`version` varchar(16) NOT NULL,
	`platform` varchar(16),
	`evidence` varchar(200),
	`poster` varchar(40),
	`role` varchar(16),
	`role_source` varchar(8),
	`title_tags` json NOT NULL,
	`analyzed_at` datetime NOT NULL,
	CONSTRAINT `article_writing_article_id` PRIMARY KEY(`article_id`)
);
--> statement-breakpoint
CREATE TABLE `writing_people` (
	`name` varchar(40) NOT NULL,
	`role` varchar(16) NOT NULL,
	`source` varchar(8) NOT NULL,
	`hits` int NOT NULL DEFAULT 0,
	`total` int NOT NULL DEFAULT 0,
	`note` varchar(255),
	`email` varchar(255),
	`updated_at` datetime NOT NULL,
	CONSTRAINT `writing_people_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `writing_people_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(40) NOT NULL,
	`before` varchar(16),
	`after` varchar(16),
	`note` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `writing_people_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `article_writing_day` ON `article_writing` (`day`,`media`);--> statement-breakpoint
CREATE INDEX `article_writing_media` ON `article_writing` (`media`,`day`);--> statement-breakpoint
CREATE INDEX `article_writing_poster` ON `article_writing` (`poster`);--> statement-breakpoint
CREATE INDEX `article_writing_version` ON `article_writing` (`version`,`published_at`);--> statement-breakpoint
CREATE INDEX `writing_people_log_name` ON `writing_people_log` (`name`,`at`);