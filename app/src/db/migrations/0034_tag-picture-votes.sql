CREATE TABLE `tag_picture_votes` (
	`tag` varchar(60) NOT NULL,
	`kind` varchar(8) NOT NULL,
	`user_id` int NOT NULL,
	`rank` int NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `tag_picture_votes_tag_kind_user_id_pk` PRIMARY KEY(`tag`,`kind`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `tag_avatar_candidates` ADD `uploaded_by` int;--> statement-breakpoint
ALTER TABLE `tag_avatar_candidates` ADD `uploaded_at` datetime;--> statement-breakpoint
ALTER TABLE `tag_visual_candidates` ADD `uploaded_by` int;--> statement-breakpoint
ALTER TABLE `tag_visual_candidates` ADD `uploaded_at` datetime;--> statement-breakpoint
CREATE INDEX `tag_picture_votes_rank` ON `tag_picture_votes` (`tag`,`kind`,`rank`);