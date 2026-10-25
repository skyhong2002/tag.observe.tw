-- Outlet roles (性質) become media labels with the same keys, after the
-- existing labels. Only a DB that already has labels gets them here; an empty
-- one is seeded from media-catalog.json. media_roles itself stays for now.
INSERT IGNORE INTO media_category_defs (`key`, label, sort, created_at)
SELECT r.k, r.label, (SELECT COALESCE(MAX(sort), 0) FROM media_category_defs) + r.n, UTC_TIMESTAMP()
FROM (
  SELECT 'wire' AS k, '通訊社' AS label, 1 AS n
  UNION ALL SELECT 'platform', '平台代刊', 2
  UNION ALL SELECT 'discovery', '發現來源', 3
  UNION ALL SELECT 'corporate', '企業內容', 4
  UNION ALL SELECT 'government', '政府機關', 5
  UNION ALL SELECT 'partner', '新聞合作', 6
) r
WHERE EXISTS (SELECT 1 FROM media_category_defs);--> statement-breakpoint
INSERT IGNORE INTO media_categories (media, category)
SELECT media, role FROM media_roles WHERE role IN (SELECT `key` FROM media_category_defs);
