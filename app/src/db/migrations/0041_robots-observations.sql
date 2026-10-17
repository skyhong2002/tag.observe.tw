CREATE TABLE `robots_observations` (
	`host` varchar(253) NOT NULL,
	`status` varchar(16) NOT NULL,
	`http_status` int,
	`google_only` boolean NOT NULL DEFAULT false,
	`disallow` json NOT NULL,
	`error` varchar(255),
	`checked_at` datetime NOT NULL,
	`last_ok_at` datetime,
	CONSTRAINT `robots_observations_host` PRIMARY KEY(`host`)
);
