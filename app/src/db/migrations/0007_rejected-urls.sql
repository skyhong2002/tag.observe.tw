CREATE TABLE `rejected_urls` (
	`media` varchar(32) NOT NULL,
	`url_key` varchar(512) NOT NULL,
	`reason` varchar(64) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `rejected_media_key` UNIQUE(`media`,`url_key`)
);
--> statement-breakpoint
CREATE INDEX `rejected_created` ON `rejected_urls` (`created_at`);