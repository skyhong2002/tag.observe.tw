ALTER TABLE `articles` DROP INDEX `articles_media_id`;--> statement-breakpoint
ALTER TABLE `articles` MODIFY COLUMN `media_id` int;--> statement-breakpoint
ALTER TABLE `articles` ADD `canonical` varchar(512);--> statement-breakpoint
ALTER TABLE `articles` ADD `category` varchar(64);--> statement-breakpoint
ALTER TABLE `articles` ADD `creator` varchar(256);--> statement-breakpoint
ALTER TABLE `articles` ADD `fetched_at` datetime;--> statement-breakpoint
ALTER TABLE `articles` ADD `fetch_status` varchar(16);--> statement-breakpoint
ALTER TABLE `articles` ADD `source` varchar(8) DEFAULT 'own' NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_media_url` UNIQUE(`media`,`url`);--> statement-breakpoint
CREATE INDEX `articles_media_id` ON `articles` (`media`,`media_id`);--> statement-breakpoint
CREATE INDEX `articles_media_fetch` ON `articles` (`media`,`fetched_at`);