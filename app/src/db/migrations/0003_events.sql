CREATE TABLE `event_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(15) NOT NULL,
	`hour_start` datetime NOT NULL,
	`computed_at` datetime NOT NULL,
	`ranking_snapshot_id` int,
	`event_count` int NOT NULL,
	`duration_ms` int NOT NULL,
	`detail` text,
	CONSTRAINT `event_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_snapshot_hour` UNIQUE(`category`,`hour_start`)
);
--> statement-breakpoint
CREATE TABLE `event_threads` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`category` varchar(15) NOT NULL,
	`first_time` datetime NOT NULL,
	`last_time` datetime NOT NULL,
	`hours` int NOT NULL,
	`all_tags` json NOT NULL,
	`major_tags` json NOT NULL,
	`max_tag` varchar(60),
	`max_score_micro` int NOT NULL DEFAULT 0,
	`history` json NOT NULL,
	`combined_from` json NOT NULL,
	`combined_to` json NOT NULL,
	`hours_total` int,
	`equal_first_time` datetime,
	`equal_last_time` datetime,
	CONSTRAINT `event_threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`snapshot_id` int NOT NULL,
	`rank` int NOT NULL,
	`score_micro` int NOT NULL,
	`tags` json NOT NULL,
	`major` json NOT NULL,
	`news` json NOT NULL,
	`major_news` json NOT NULL,
	`thread_id` bigint,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `threads_last` ON `event_threads` (`category`,`last_time`);--> statement-breakpoint
CREATE INDEX `threads_first` ON `event_threads` (`category`,`first_time`);--> statement-breakpoint
CREATE INDEX `events_snapshot` ON `events` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE INDEX `events_thread` ON `events` (`thread_id`);