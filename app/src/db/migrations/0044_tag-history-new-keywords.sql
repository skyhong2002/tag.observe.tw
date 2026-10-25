ALTER TABLE `tag_history` MODIFY COLUMN `peak_day` date;--> statement-breakpoint
ALTER TABLE `tag_history` MODIFY COLUMN `peak_count` int;--> statement-breakpoint
ALTER TABLE `tag_history` MODIFY COLUMN `computed_at` datetime;--> statement-breakpoint
ALTER TABLE `tag_history` ADD `last_at` datetime;--> statement-breakpoint
ALTER TABLE `tag_history` ADD `article_count` int;--> statement-breakpoint
CREATE INDEX `tag_history_first` ON `tag_history` (`first_at`);