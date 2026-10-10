CREATE TABLE `media_taiwan_share_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`media` varchar(32) NOT NULL,
	`before` double,
	`after` double,
	`note` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `media_taiwan_share_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_taiwan_shares` (
	`media` varchar(32) NOT NULL,
	`share` double NOT NULL,
	`note` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `media_taiwan_shares_media` PRIMARY KEY(`media`)
);
--> statement-breakpoint
CREATE INDEX `media_taiwan_share_log_media` ON `media_taiwan_share_log` (`media`,`at`);