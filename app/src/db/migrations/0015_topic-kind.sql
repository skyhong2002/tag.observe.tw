ALTER TABLE `topics` ADD `kind` varchar(16) DEFAULT 'topic' NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `kind_source` varchar(8);--> statement-breakpoint
ALTER TABLE `topics` ADD `sponsored` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `parent_id` bigint;--> statement-breakpoint
ALTER TABLE `topics` ADD `story_first_at` datetime;--> statement-breakpoint
ALTER TABLE `topics` ADD `story_last_at` datetime;--> statement-breakpoint
ALTER TABLE `topics` ADD `story_count` int;--> statement-breakpoint
ALTER TABLE `topics` ADD `story_grew_at` datetime;--> statement-breakpoint
ALTER TABLE `topics` ADD `backlog` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `topics_kind_media_seen` ON `topics` (`kind`,`media`,`first_seen`);