CREATE TABLE `tag_history` (
	`tag` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`first_at` datetime NOT NULL,
	`peak_day` date NOT NULL,
	`peak_count` int NOT NULL,
	`computed_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `tag_history_tag` PRIMARY KEY(`tag`)
);
--> statement-breakpoint
CREATE INDEX `tag_history_computed` ON `tag_history` (`computed_at`);