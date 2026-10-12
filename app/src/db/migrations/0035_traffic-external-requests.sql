CREATE TABLE `traffic_external_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requester` varchar(16) NOT NULL,
	`domain` varchar(253) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`requested_at` datetime NOT NULL,
	`status` varchar(8) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`next_attempt_at` datetime,
	`last_attempt_at` datetime,
	`last_error` varchar(255),
	`fetched_at` datetime,
	`refused_at` datetime,
	`result` json,
	CONSTRAINT `traffic_external_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `traffic_external_requests_key` UNIQUE(`requester`,`domain`,`kind`)
);
--> statement-breakpoint
CREATE TABLE `traffic_external_sends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domain` varchar(253) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `traffic_external_sends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `traffic_external_requests_due` ON `traffic_external_requests` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `traffic_external_requests_refused` ON `traffic_external_requests` (`refused_at`);--> statement-breakpoint
CREATE INDEX `traffic_external_sends_at` ON `traffic_external_sends` (`at`);