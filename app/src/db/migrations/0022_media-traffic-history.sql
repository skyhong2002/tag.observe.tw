CREATE TABLE `media_radar_ranks` (
	`domain` varchar(255) NOT NULL,
	`date_end` datetime NOT NULL,
	`date_start` datetime NOT NULL,
	`rank` int,
	`bucket` int,
	`bucket_lower_bound` int,
	`first_seen_at` datetime NOT NULL,
	`fetched_at` datetime NOT NULL,
	CONSTRAINT `media_radar_ranks_domain_date_end_pk` PRIMARY KEY(`domain`,`date_end`)
);
--> statement-breakpoint
CREATE TABLE `media_traffic_months` (
	`domain` varchar(255) NOT NULL,
	`month` varchar(6) NOT NULL,
	`visits` bigint NOT NULL,
	`first_seen_at` datetime NOT NULL,
	`fetched_at` datetime NOT NULL,
	CONSTRAINT `media_traffic_months_domain_month_pk` PRIMARY KEY(`domain`,`month`)
);
--> statement-breakpoint
CREATE TABLE `media_traffic_profiles` (
	`domain` varchar(255) NOT NULL,
	`month` varchar(6) NOT NULL,
	`profile` json NOT NULL,
	`first_seen_at` datetime NOT NULL,
	`fetched_at` datetime NOT NULL,
	CONSTRAINT `media_traffic_profiles_domain_month_pk` PRIMARY KEY(`domain`,`month`)
);
--> statement-breakpoint
CREATE INDEX `media_radar_ranks_date` ON `media_radar_ranks` (`date_end`);--> statement-breakpoint
CREATE INDEX `media_traffic_months_month` ON `media_traffic_months` (`month`);