CREATE TABLE `media_categories` (
	`media` varchar(32) NOT NULL,
	`category` varchar(32) NOT NULL,
	CONSTRAINT `media_categories_media_category_pk` PRIMARY KEY(`media`,`category`)
);
--> statement-breakpoint
CREATE TABLE `media_category_defs` (
	`key` varchar(32) NOT NULL,
	`label` varchar(64) NOT NULL,
	`sort` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `media_category_defs_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `media_category_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`media` varchar(32) NOT NULL,
	`category` varchar(32) NOT NULL,
	`action` varchar(8) NOT NULL,
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `media_category_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `media_categories_category` ON `media_categories` (`category`);--> statement-breakpoint
CREATE INDEX `media_category_log_media` ON `media_category_log` (`media`,`at`);