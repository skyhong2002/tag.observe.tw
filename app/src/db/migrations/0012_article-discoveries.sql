CREATE TABLE `article_discoveries` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`article_id` bigint NOT NULL,
	`media` varchar(32) NOT NULL,
	`discovery_url` text NOT NULL,
	`discovered_at` datetime NOT NULL,
	CONSTRAINT `article_discoveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `discovery_article_media` UNIQUE(`article_id`,`media`)
);
--> statement-breakpoint
CREATE INDEX `discovery_media_article` ON `article_discoveries` (`media`,`article_id`);