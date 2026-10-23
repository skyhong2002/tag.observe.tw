CREATE TABLE `tag_history` (
	`tag` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`first_at` datetime NOT NULL,
	`last_at` datetime,
	`article_count` int,
	`peak_day` date,
	`peak_count` int,
	`computed_at` datetime,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `tag_history_tag` PRIMARY KEY(`tag`)
);
--> statement-breakpoint
CREATE INDEX `tag_history_computed` ON `tag_history` (`computed_at`);--> statement-breakpoint
CREATE INDEX `tag_history_first` ON `tag_history` (`first_at`);