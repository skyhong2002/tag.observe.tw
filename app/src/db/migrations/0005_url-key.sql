ALTER TABLE `articles` ADD `url_key` varchar(512);--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_media_url_key` UNIQUE(`media`,`url_key`);