ALTER TABLE `tag_group_defs` ADD `writing_role` varchar(16);
--> statement-breakpoint
INSERT IGNORE INTO tag_group_defs (id, label, kind, sort, created_at) VALUES
(1, '政治人物', 'group', 0, NOW()),
(2, '現任立委', 'group', 1, NOW()),
(3, '現任縣市長', 'group', 2, NOW()),
(4, '民進黨', 'group', 3, NOW()),
(5, '國民黨', 'group', 4, NOW()),
(6, '時代力量', 'group', 5, NOW()),
(7, '親民黨', 'group', 6, NOW()),
(8, '意見領袖', 'group', 7, NOW()),
(9, '運動明星', 'group', 8, NOW()),
(10, '名嘴', 'group', 9, NOW()),
(11, '藝人', 'group', 10, NOW()),
(12, '歌手樂團', 'group', 11, NOW()),
(13, '商場經理人', 'group', 12, NOW()),
(14, '縣市議員', 'group', 13, NOW()),
(15, '議題', 'group', 14, NOW()),
(16, '政府部門單位', 'group', 15, NOW()),
(17, '公司廠商', 'group', 16, NOW()),
(18, '內閣', 'group', 17, NOW()),
(19, '北市府', 'group', 18, NOW()),
(20, '社會新聞人物', 'group', 19, NOW()),
(21, '外語藝人', 'group', 20, NOW()),
(22, '中港藝人', 'group', 21, NOW()),
(23, '外國運動員', 'group', 22, NOW()),
(24, '外國政治人物', 'group', 23, NOW()),
(25, '電視電影', 'group', 24, NOW()),
(26, '商品店家', 'group', 25, NOW()),
(27, '網紅', 'group', 26, NOW()),
(28, '六都市長候選人', 'group', 27, NOW()),
(101, '政治', 'topic', 28, NOW()),
(102, '體育', 'topic', 29, NOW()),
(103, '娛樂', 'topic', 30, NOW()),
(104, '社會', 'topic', 31, NOW()),
(105, '國際', 'topic', 32, NOW()),
(106, '生活', 'topic', 33, NOW()),
(107, '科技', 'topic', 34, NOW()),
(108, '動物', 'topic', 35, NOW()),
(109, '健康醫療', 'topic', 36, NOW()),
(110, '產業金融', 'topic', 37, NOW());
--> statement-breakpoint
ALTER TABLE `tag_group_defs` AUTO_INCREMENT = 1000;
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '政治人物', 'group', '公職政治', 200, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '政治人物' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '公職政治' WHERE label = '政治人物' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '政治人物' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"公職政治"');
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '前任公職', 'group', '前任公職', 201, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '前任公職' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '前任公職' WHERE label = '前任公職' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '前任公職' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"前任公職"');
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '評論、名嘴', 'group', '評論名嘴', 202, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '評論、名嘴' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '評論名嘴' WHERE label = '評論、名嘴' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '評論、名嘴' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"評論名嘴"');
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '專家、企業人士', 'group', '專家企業', 203, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '專家、企業人士' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '專家企業' WHERE label = '專家、企業人士' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '專家、企業人士' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"專家企業"');
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '醫療健康', 'group', '醫療健康', 204, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '醫療健康' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '醫療健康' WHERE label = '醫療健康' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '醫療健康' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"醫療健康"');
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '氣象', 'group', '氣象', 205, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '氣象' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '氣象' WHERE label = '氣象' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '氣象' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"氣象"');
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '藝人、網紅', 'group', '藝人網紅', 206, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '藝人、網紅' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '藝人網紅' WHERE label = '藝人、網紅' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '藝人、網紅' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"藝人網紅"');
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '公司、團體', 'group', '機構', 207, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '公司、團體' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '機構' WHERE label = '公司、團體' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '公司、團體' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"機構"');
--> statement-breakpoint
INSERT INTO tag_group_defs (label, kind, writing_role, sort, created_at) SELECT '網友、民眾', 'group', '網友民眾', 208, NOW() WHERE NOT EXISTS (SELECT 1 FROM tag_group_defs WHERE label = '網友、民眾' AND kind = 'group' AND deleted_at IS NULL);
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '網友民眾' WHERE label = '網友、民眾' AND kind = 'group' AND deleted_at IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO tag_group_members (tag, group_id, source, status, note, updated_at, reviewed_by, reviewed_at) SELECT p.name, g.id, 'admin', 'confirmed', LEFT(p.note, 120), p.updated_at, p.email, p.updated_at FROM writing_people p JOIN tag_group_defs g ON g.label = '網友、民眾' AND g.kind = 'group' AND g.deleted_at IS NULL WHERE p.source = 'admin' AND JSON_CONTAINS(COALESCE(p.roles, JSON_ARRAY(p.role)), '"網友民眾"');
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '公職政治' WHERE kind = 'group' AND label IN ('現任立委', '現任縣市長', '民進黨', '國民黨', '時代力量', '親民黨', '縣市議員', '內閣', '北市府', '外國政治人物', '六都市長候選人', '政府部門單位') AND deleted_at IS NULL;
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '評論名嘴' WHERE kind = 'group' AND label IN ('意見領袖', '名嘴') AND deleted_at IS NULL;
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '藝人網紅' WHERE kind = 'group' AND label IN ('運動明星', '藝人', '歌手樂團', '外語藝人', '中港藝人', '外國運動員', '網紅') AND deleted_at IS NULL;
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '專家企業' WHERE kind = 'group' AND label IN ('商場經理人') AND deleted_at IS NULL;
--> statement-breakpoint
UPDATE tag_group_defs SET writing_role = '機構' WHERE kind = 'group' AND label IN ('公司廠商') AND deleted_at IS NULL;
--> statement-breakpoint
UPDATE writing_people p SET p.roles = COALESCE((
  SELECT JSON_ARRAYAGG(DISTINCT g.writing_role ORDER BY FIELD(g.writing_role, '公職政治', '前任公職', '評論名嘴', '專家企業', '醫療健康', '氣象', '藝人網紅', '機構', '網友民眾'))
  FROM tag_group_members m JOIN tag_group_defs g ON g.id = m.group_id
  WHERE m.tag = p.name AND m.status IN ('auto', 'confirmed') AND g.deleted_at IS NULL AND g.writing_role IS NOT NULL
), JSON_ARRAY('未知')) WHERE p.source = 'admin';
--> statement-breakpoint
UPDATE writing_people SET role = JSON_UNQUOTE(JSON_EXTRACT(roles, '$[0]')) WHERE source = 'admin';
--> statement-breakpoint
UPDATE article_writing w JOIN writing_people p ON p.name = w.poster AND p.source = 'admin'
SET w.role = p.role, w.roles = p.roles, w.role_source = 'people';
