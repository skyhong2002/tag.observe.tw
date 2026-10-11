CREATE TABLE `tag_group_defs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(32) NOT NULL,
	`kind` varchar(8) NOT NULL,
	`sort` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `tag_group_defs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tag_group_member_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag` varchar(60) NOT NULL,
	`group_id` int NOT NULL,
	`action` varchar(8) NOT NULL,
	`from_status` varchar(10),
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `tag_group_member_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tag_group_members` (
	`tag` varchar(60) NOT NULL,
	`group_id` int NOT NULL,
	`source` varchar(10) NOT NULL,
	`status` varchar(10) NOT NULL,
	`score` double,
	`note` varchar(120),
	`updated_at` datetime NOT NULL,
	`reviewed_by` varchar(255),
	`reviewed_at` datetime,
	CONSTRAINT `tag_group_members_tag_group_id_pk` PRIMARY KEY(`tag`,`group_id`)
);
--> statement-breakpoint
CREATE TABLE `tag_wikidata` (
	`tag` varchar(60) NOT NULL,
	`wikidata_id` varchar(16),
	`label` varchar(120),
	`description` varchar(255),
	`types` json,
	`checked_at` datetime,
	`ai_checked_at` datetime,
	CONSTRAINT `tag_wikidata_tag` PRIMARY KEY(`tag`)
);
--> statement-breakpoint
CREATE INDEX `tag_group_member_log_tag` ON `tag_group_member_log` (`tag`,`at`);--> statement-breakpoint
CREATE INDEX `tag_group_members_group` ON `tag_group_members` (`group_id`,`status`);