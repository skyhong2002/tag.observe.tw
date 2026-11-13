CREATE TABLE `article_content_access` (
	`article_id` bigint NOT NULL,
	`accessed_at` datetime NOT NULL,
	CONSTRAINT `article_content_access_article_id` PRIMARY KEY(`article_id`)
);
