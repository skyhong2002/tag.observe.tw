CREATE TABLE `site_metrics` (
	`day` date NOT NULL,
	`source` varchar(8) NOT NULL,
	`metric` varchar(24) NOT NULL,
	`key` varchar(255) NOT NULL DEFAULT '',
	`value` double NOT NULL,
	`label` varchar(255),
	CONSTRAINT `site_metrics_day_source_metric_key_pk` PRIMARY KEY(`day`,`source`,`metric`,`key`)
);
--> statement-breakpoint
CREATE INDEX `site_metrics_metric_day` ON `site_metrics` (`source`,`metric`,`day`);