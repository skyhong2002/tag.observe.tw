CREATE TABLE `article_citations` (
	`article_id` bigint NOT NULL,
	`source` varchar(64) NOT NULL,
	`media` varchar(32) NOT NULL,
	`published_at` datetime NOT NULL,
	`day` date NOT NULL,
	CONSTRAINT `article_citations_pk` PRIMARY KEY(`article_id`,`source`)
);
--> statement-breakpoint
CREATE TABLE `article_sketches` (
	`article_id` bigint NOT NULL,
	`media` varchar(32) NOT NULL,
	`published_at` datetime NOT NULL,
	`chars` int NOT NULL,
	`sketch` varbinary(512),
	CONSTRAINT `article_sketches_article_id` PRIMARY KEY(`article_id`)
);
--> statement-breakpoint
CREATE TABLE `similarity_pairs` (
	`a_id` bigint NOT NULL,
	`b_id` bigint NOT NULL,
	`a_media` varchar(32) NOT NULL,
	`b_media` varchar(32) NOT NULL,
	`a_published` datetime NOT NULL,
	`b_published` datetime NOT NULL,
	`first_published` datetime NOT NULL,
	`last_published` datetime NOT NULL,
	`day` date NOT NULL,
	`score` double NOT NULL,
	`containment` double NOT NULL,
	`shared` int NOT NULL,
	`kind` varchar(10) NOT NULL,
	`evidence` varchar(100) NOT NULL,
	`computed_at` datetime NOT NULL,
	CONSTRAINT `similarity_pairs_pk` PRIMARY KEY(`a_id`,`b_id`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD `similarity_at` datetime;--> statement-breakpoint
CREATE INDEX `citations_published` ON `article_citations` (`published_at`);--> statement-breakpoint
CREATE INDEX `citations_day` ON `article_citations` (`day`,`media`);--> statement-breakpoint
CREATE INDEX `sketches_published` ON `article_sketches` (`published_at`);--> statement-breakpoint
CREATE INDEX `pairs_b` ON `similarity_pairs` (`b_id`);--> statement-breakpoint
CREATE INDEX `pairs_last` ON `similarity_pairs` (`last_published`,`first_published`);--> statement-breakpoint
CREATE INDEX `pairs_day` ON `similarity_pairs` (`day`,`score`);--> statement-breakpoint
CREATE INDEX `articles_similarity` ON `articles` (`similarity_at`,`body_status`,`published_at`);