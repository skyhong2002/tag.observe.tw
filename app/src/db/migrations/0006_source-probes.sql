CREATE TABLE `source_probes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`media` varchar(32) NOT NULL,
	`checked_at` datetime NOT NULL,
	`kind` varchar(16) NOT NULL,
	`url` varchar(512),
	`recent_items` int NOT NULL DEFAULT 0,
	`detail` text,
	CONSTRAINT `source_probes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `source_probes_media` ON `source_probes` (`media`,`checked_at`);