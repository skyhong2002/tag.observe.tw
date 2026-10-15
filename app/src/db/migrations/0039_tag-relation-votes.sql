CREATE TABLE `tag_relation_votes` (
	`relation_key` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`value` int NOT NULL,
	`tag` varchar(60) NOT NULL,
	`at` datetime NOT NULL,
	CONSTRAINT `tag_relation_votes_relation_key_user_id_pk` PRIMARY KEY(`relation_key`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX `tag_relation_votes_tag` ON `tag_relation_votes` (`tag`);