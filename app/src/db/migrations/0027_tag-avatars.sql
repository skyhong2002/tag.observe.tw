CREATE TABLE `tag_avatar_candidates` (
	`tag` varchar(60) NOT NULL,
	`rank` int NOT NULL,
	`file` varchar(255) NOT NULL,
	`page_url` varchar(512) NOT NULL,
	`license` varchar(64),
	`license_url` varchar(255),
	`artist` varchar(255),
	`score` double NOT NULL,
	`scores` json NOT NULL,
	`verdict` varchar(10) NOT NULL,
	`image` mediumblob NOT NULL,
	CONSTRAINT `tag_avatar_candidates_tag_rank_pk` PRIMARY KEY(`tag`,`rank`)
);
--> statement-breakpoint
CREATE TABLE `tag_people` (
	`tag` varchar(60) NOT NULL,
	`wikidata_id` varchar(16),
	`label` varchar(120),
	`description` varchar(255),
	`facts` json,
	`status` varchar(8) NOT NULL,
	`note` varchar(120),
	`shown_rank` int,
	`checked_at` datetime NOT NULL,
	`reviewed_by` varchar(255),
	`reviewed_at` datetime,
	CONSTRAINT `tag_people_tag` PRIMARY KEY(`tag`)
);
--> statement-breakpoint
CREATE TABLE `tag_people_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag` varchar(60) NOT NULL,
	`action` varchar(8) NOT NULL,
	`from_rank` int,
	`to_rank` int,
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `tag_people_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tag_people_status` ON `tag_people` (`status`,`checked_at`);--> statement-breakpoint
CREATE INDEX `tag_people_wikidata` ON `tag_people` (`wikidata_id`);--> statement-breakpoint
CREATE INDEX `tag_people_log_tag` ON `tag_people_log` (`tag`,`at`);