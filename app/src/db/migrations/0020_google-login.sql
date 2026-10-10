CREATE TABLE `user_sessions` (
	`token_hash` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`created_at` datetime NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `user_sessions_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`google_sub` varchar(64) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(255),
	`picture` varchar(512),
	`created_at` datetime NOT NULL,
	`last_login_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_google_sub` UNIQUE(`google_sub`)
);
--> statement-breakpoint
CREATE INDEX `user_sessions_user` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires` ON `user_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `users_email` ON `users` (`email`);