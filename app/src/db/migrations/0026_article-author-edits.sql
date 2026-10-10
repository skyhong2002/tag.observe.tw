CREATE TABLE `article_author_edits` (
	`article_id` bigint NOT NULL,
	`edited_at` datetime NOT NULL,
	`email` varchar(255) NOT NULL,
	CONSTRAINT `article_author_edits_article_id` PRIMARY KEY(`article_id`)
);
--> statement-breakpoint
CREATE TABLE `article_author_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`article_id` bigint NOT NULL,
	`before` json NOT NULL,
	`after` json NOT NULL,
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `article_author_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `article_author_log_article` ON `article_author_log` (`article_id`,`at`);