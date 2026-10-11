CREATE TABLE `user_role_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`role` varchar(8) NOT NULL,
	`email` varchar(255) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `user_role_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `admin_granted_by` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `admin_granted_at` datetime;--> statement-breakpoint
CREATE INDEX `user_role_log_user` ON `user_role_log` (`user_id`,`at`);