CREATE TABLE `crawl_runs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`media` varchar(32) NOT NULL,
	`stage` varchar(8) NOT NULL,
	`started_at` datetime NOT NULL,
	`finished_at` datetime,
	`status` varchar(12) NOT NULL,
	`fetched` int NOT NULL DEFAULT 0,
	`inserted` int NOT NULL DEFAULT 0,
	`updated` int NOT NULL DEFAULT 0,
	`failed` int NOT NULL DEFAULT 0,
	`detail` text,
	CONSTRAINT `crawl_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `crawl_runs_media` ON `crawl_runs` (`media`,`started_at`);