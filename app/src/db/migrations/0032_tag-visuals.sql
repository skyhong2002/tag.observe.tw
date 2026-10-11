CREATE TABLE `tag_visual_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag` varchar(60) NOT NULL,
	`action` varchar(8) NOT NULL,
	`detail` varchar(120),
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `tag_visual_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tag_visuals` (
	`tag` varchar(60) NOT NULL,
	`kind` varchar(8),
	`status` varchar(8) NOT NULL,
	`value` varchar(64),
	`wikidata_id` varchar(16),
	`label` varchar(120),
	`note` varchar(120),
	`image` mediumblob,
	`large` mediumblob,
	`page_url` varchar(512),
	`license` varchar(64),
	`license_url` varchar(255),
	`artist` varchar(255),
	`checked_at` datetime NOT NULL,
	`reviewed_by` varchar(255),
	`reviewed_at` datetime,
	CONSTRAINT `tag_visuals_tag` PRIMARY KEY(`tag`)
);
--> statement-breakpoint
CREATE INDEX `tag_visual_log_tag` ON `tag_visual_log` (`tag`,`at`);--> statement-breakpoint
CREATE INDEX `tag_visuals_status` ON `tag_visuals` (`status`,`checked_at`);