ALTER TABLE `articles` ADD INDEX `articles_source_media_published` (`source`,`media`,`published_at`), ALGORITHM=INPLACE, LOCK=NONE;
