CREATE TABLE `tag_group_def_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`group_id` int NOT NULL,
	`action` varchar(8) NOT NULL,
	`detail` varchar(120),
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `tag_group_def_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tag_group_defs` ADD `parent_id` int;--> statement-breakpoint
ALTER TABLE `tag_group_defs` ADD `deleted_at` datetime;--> statement-breakpoint
CREATE INDEX `tag_group_def_log_group` ON `tag_group_def_log` (`group_id`,`at`);