CREATE TABLE `tag_relation_lock` (
	`id` int NOT NULL,
	CONSTRAINT `tag_relation_lock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tag_submission_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submission_id` int NOT NULL,
	`action` varchar(16) NOT NULL,
	`user_id` int NOT NULL,
	`at` datetime NOT NULL,
	`reason` varchar(1000),
	CONSTRAINT `tag_submission_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tag_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` varchar(16) NOT NULL,
	`tag` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`relation_type` varchar(16),
	`target` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
	`target_group_id` int,
	`reason` varchar(1000),
	`status` varchar(16) NOT NULL,
	`source` varchar(16) NOT NULL,
	`created_by` int NOT NULL,
	`created_at` datetime NOT NULL,
	`reviewed_by` int,
	`reviewed_at` datetime,
	`review_reason` varchar(1000),
	`dedupe_key` varchar(64) NOT NULL,
	`picture_kind` varchar(16),
	`image` mediumblob,
	`picture_meta` json,
	`rights_confirmed` boolean NOT NULL DEFAULT false,
	`candidate_rank` int,
	CONSTRAINT `tag_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `tag_submission_dedupe` UNIQUE(`dedupe_key`)
);
--> statement-breakpoint
CREATE INDEX `tag_submission_history` ON `tag_submission_log` (`submission_id`,`id`);--> statement-breakpoint
CREATE INDEX `tag_submission_queue` ON `tag_submissions` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `tag_submission_outgoing` ON `tag_submissions` (`tag`,`kind`,`status`);--> statement-breakpoint
CREATE INDEX `tag_submission_incoming` ON `tag_submissions` (`target`,`kind`,`status`);--> statement-breakpoint
CREATE INDEX `tag_submission_author` ON `tag_submissions` (`created_by`,`created_at`);
--> statement-breakpoint
INSERT INTO `tag_relation_lock` (`id`) VALUES (1);
