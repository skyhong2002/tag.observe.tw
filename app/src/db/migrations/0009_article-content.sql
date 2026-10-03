ALTER TABLE `articles` ADD `body` longtext;--> statement-breakpoint
ALTER TABLE `articles` ADD `authors` json;--> statement-breakpoint
ALTER TABLE `articles` ADD `body_status` varchar(16);--> statement-breakpoint
ALTER TABLE `articles` ADD `body_source` varchar(128);--> statement-breakpoint
ALTER TABLE `articles` ADD `content_fetched_at` datetime;--> statement-breakpoint
ALTER TABLE `articles` ADD `attributions` json;