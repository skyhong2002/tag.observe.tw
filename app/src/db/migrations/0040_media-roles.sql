CREATE TABLE `media_roles` (
	`media` varchar(32) NOT NULL,
	`role` varchar(24) NOT NULL,
	CONSTRAINT `media_roles_media_role_pk` PRIMARY KEY(`media`,`role`)
);
