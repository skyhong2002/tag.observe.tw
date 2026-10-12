ALTER TABLE `article_writing` ADD `roles` json;--> statement-breakpoint
ALTER TABLE `writing_people` ADD `roles` json;--> statement-breakpoint
ALTER TABLE `writing_people_log` ADD `before_roles` json;--> statement-breakpoint
ALTER TABLE `writing_people_log` ADD `after_roles` json;