CREATE TABLE `tag_visual_candidates` (
	`tag` varchar(60) NOT NULL,
	`rank` int NOT NULL,
	`kind` varchar(8) NOT NULL,
	`value` varchar(64),
	`wikidata_id` varchar(16),
	`label` varchar(120),
	`note` varchar(120),
	`image` mediumblob,
	`large` mediumblob,
	`page_url` varchar(512),
	`license` varchar(64),
	`license_url` varchar(255),
	`artist` varchar(255),
	CONSTRAINT `tag_visual_candidates_tag_rank_pk` PRIMARY KEY(`tag`,`rank`)
);
--> statement-breakpoint
ALTER TABLE `tag_visuals` ADD `shown_rank` int;