CREATE TABLE `article_tag_edits` (
	`article_id` bigint NOT NULL,
	`edited_at` datetime NOT NULL,
	`email` varchar(255) NOT NULL,
	CONSTRAINT `article_tag_edits_article_id` PRIMARY KEY(`article_id`)
);
--> statement-breakpoint
CREATE TABLE `article_tag_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`article_id` bigint NOT NULL,
	`tag` varchar(60) NOT NULL,
	`action` varchar(8) NOT NULL,
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `article_tag_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `article_tag_log_article` ON `article_tag_log` (`article_id`,`at`);