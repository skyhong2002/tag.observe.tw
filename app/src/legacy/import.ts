import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { normalizeLegacyArticle } from './normalize.ts';

export type LegacyCandidate = ReturnType<typeof normalizeLegacyArticle>;
export type ImportOutcome = { sourceKey: string; rawHash: string; action: string; reason?: string; articleId?: string };
const dateSql = (value: string) => new Date(value).toISOString().slice(0, 19).replace('T', ' ');

export function importIssue(row: LegacyCandidate, now: Date, allowRecent = false): string | null {
  if (row.disposition !== 'candidate') return row.reasons.join(',');
  // Initial migration deliberately excludes the crawler's entire 90-day window.
  const cutoff = now.getTime() - 91 * 86400_000;
  if (!allowRecent && [row.article.publishedAt, row.article.crawledAt].some((v) => !v || Date.parse(v) >= cutoff))
    return 'recent_requires_separate_review';
  if (Buffer.byteLength(String(row.article.description ?? ''), 'utf8') > 65535) return 'description_exceeds_text_bytes';
  if (row.lineage.objects.length !== 1) return 'requires_single_source_chunk';
  return null;
}

// Each invocation uses one dedicated connection. Dry runs change only temporary
// copies; both modes use the database's real collations and unique indexes.
export async function importCandidates(
  connection: PoolConnection,
  rows: LegacyCandidate[],
  options: {
    apply: boolean;
    allowRecent?: boolean;
    generation: string;
    object: string;
    now: Date;
    onBatch?: (outcomes: ImportOutcome[]) => void;
  },
) {
  if (new Set(rows.map((row) => row.lineage.sourceKey)).size !== rows.length) throw new Error('Duplicate source keys in package');
  const c = connection;
  const query = async (sql: string, values: unknown[] = []) => (await c.query<RowDataPacket[]>(sql, values))[0];
  const lock = `legacy-import:${(await query('SELECT DATABASE() db'))[0].db}`;
  if ((await query('SELECT GET_LOCK(?, 0) acquired', [lock]))[0].acquired !== 1) throw new Error('Another legacy importer is running');
  const names = options.apply
    ? { articles: 'articles', origins: 'article_origins', tags: 'article_tags' }
    : { articles: 'legacy_dry_articles', origins: 'legacy_dry_origins', tags: 'legacy_dry_tags' };
  const outcomes: ImportOutcome[] = [];
  try {
    await c.query(
      "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
    );
    await c.query('SET SESSION innodb_lock_wait_timeout=5');
    const engines = await query(
      "SELECT table_name,engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('articles','article_origins','article_tags')",
    );
    if (engines.length !== 3 || engines.some((r) => r.engine !== 'InnoDB')) throw new Error('Transactional migrated tables required');
    await c.query('SELECT content_accessed_at,content_archive_hash FROM articles LIMIT 0');
    const media = [...new Set(rows.map((r) => r.article.media))];
    if (!media.length || media.length > 500) throw new Error('Invalid media count in package');
    if (!options.apply) {
      for (const [target, source] of [
        [names.articles, 'articles'],
        [names.origins, 'article_origins'],
        [names.tags, 'article_tags'],
      ]) {
        await c.query(`CREATE TEMPORARY TABLE ${target} LIKE ${source}`);
      }
      await c.query(`INSERT INTO ${names.articles} SELECT * FROM articles WHERE media IN (?)`, [media]);
      await c.query(`INSERT INTO ${names.origins} SELECT o.* FROM article_origins o JOIN ${names.articles} a ON a.id=o.article_id`);
    }
    // Carry column collations from production, without its unique indexes, so
    // case/accent/trailing-space collisions across the entire input are found
    // before the first permanent write. All members are held for review.
    await c.query('CREATE TEMPORARY TABLE legacy_input AS SELECT media,url,url_key FROM articles WHERE 0');
    await c.query(
      'ALTER TABLE legacy_input ADD seq INT NOT NULL PRIMARY KEY, ADD INDEX input_url(media,url), ADD INDEX input_key(media,url_key)',
    );
    await c.query('CREATE TEMPORARY TABLE legacy_origin_input AS SELECT source_key FROM article_origins WHERE 0');
    await c.query('ALTER TABLE legacy_origin_input ADD seq INT NOT NULL PRIMARY KEY');
    for (let start = 0; start < rows.length; start += 250) {
      const batch = rows
        .slice(start, start + 250)
        .map((row, offset) => ({ row, seq: start + offset }))
        .filter(({ row }) => !importIssue(row, options.now, options.allowRecent));
      if (batch.length) {
        await c.query('INSERT INTO legacy_input (media,url,url_key,seq) VALUES ?', [
          batch.map(({ row, seq }) => [row.article.media, row.article.url, row.article.urlKey, seq]),
        ]);
        await c.query('INSERT INTO legacy_origin_input (source_key,seq) VALUES ?', [
          batch.map(({ row, seq }) => [row.lineage.sourceKey, seq]),
        ]);
      }
    }
    // MariaDB cannot reopen one temporary table twice in a single statement.
    await c.query('CREATE TEMPORARY TABLE legacy_dup_urls AS SELECT media,url FROM legacy_input GROUP BY media,url HAVING COUNT(*)>1');
    await c.query(
      'CREATE TEMPORARY TABLE legacy_dup_keys AS SELECT media,url_key FROM legacy_input GROUP BY media,url_key HAVING COUNT(*)>1',
    );
    await c.query('ALTER TABLE legacy_dup_urls ADD INDEX dup_url(media,url)');
    await c.query('ALTER TABLE legacy_dup_keys ADD INDEX dup_key(media,url_key)');
    const duplicates = new Set(
      (await query('SELECT i.seq FROM legacy_input i JOIN legacy_dup_urls d ON i.media=d.media AND i.url=d.url')).map((r) => Number(r.seq)),
    );
    for (const r of await query('SELECT i.seq FROM legacy_input i JOIN legacy_dup_keys d ON i.media=d.media AND i.url_key=d.url_key'))
      duplicates.add(Number(r.seq));
    for (let start = 0; start < rows.length; start += 100) {
      const batch: ImportOutcome[] = [];
      await c.beginTransaction();
      try {
        const end = Math.min(start + 100, rows.length);
        const grouped = (results: RowDataPacket[]) => {
          const map = new Map<number, RowDataPacket[]>();
          for (const result of results) {
            const key = Number(result.seq);
            const values = map.get(key) ?? [];
            values.push(result);
            map.set(key, values);
          }
          return map;
        };
        // Join by input sequence so comparisons use MariaDB's actual collations.
        // Lock matching origins/articles before any writes in this bounded transaction.
        // Force identity indexes: stale estimates on growing tables can otherwise
        // choose the media/date index and scan an entire publisher for each input.
        const originsBySeq = grouped(
          await query(
            `SELECT i.seq,o.source_key,o.raw_hash,o.article_id,a.id target_id
           FROM legacy_origin_input i STRAIGHT_JOIN ${names.origins} o ON o.source_key=i.source_key
           LEFT JOIN ${names.articles} a ON a.id=o.article_id
           WHERE i.seq>=? AND i.seq<? FOR UPDATE`,
            [start, end],
          ),
        );
        const fields = "a.id,a.media,a.url,a.url_key,a.title,DATE_FORMAT(a.published_at,'%Y-%m-%d %H:%i:%s') published_at";
        const urlsBySeq = grouped(
          await query(
            `SELECT i.seq,${fields} FROM legacy_input i STRAIGHT_JOIN ${names.articles} a FORCE INDEX (articles_media_url) ON a.media=i.media AND a.url=i.url
           WHERE i.seq>=? AND i.seq<? FOR UPDATE`,
            [start, end],
          ),
        );
        const keysBySeq = grouped(
          await query(
            `SELECT i.seq,${fields} FROM legacy_input i STRAIGHT_JOIN ${names.articles} a FORCE INDEX (articles_media_url_key) ON a.media=i.media AND a.url_key=i.url_key
           WHERE i.seq>=? AND i.seq<? FOR UPDATE`,
            [start, end],
          ),
        );
        for (let i = start; i < end; i++) {
          const row = rows[i];
          const a = row.article;
          const base = { sourceKey: row.lineage.sourceKey, rawHash: row.lineage.rawSha256 };
          const issue = importIssue(row, options.now, options.allowRecent) || (duplicates.has(i) ? 'input_identity_collision' : null);
          if (issue) {
            batch.push({ ...base, action: 'quarantine', reason: issue });
            continue;
          }
          const origins = originsBySeq.get(i) ?? [];
          if (origins.length) {
            const origin = origins.find((r) => r.source_key === base.sourceKey && r.raw_hash === base.rawHash);
            if (origin?.target_id != null) batch.push({ ...base, action: 'already_imported', articleId: String(origin.article_id) });
            else batch.push({ ...base, action: 'quarantine', reason: origin ? 'missing_origin_article' : 'source_version_conflict' });
            continue;
          }
          const byUrl = urlsBySeq.get(i) ?? [];
          const byKey = keysBySeq.get(i) ?? [];
          const matches = [...new Map([...byUrl, ...byKey].map((r) => [String(r.id), r])).values()];
          let articleId: string;
          let action: string;
          if (matches.length) {
            const existing = matches[0];
            if (
              matches.length !== 1 ||
              existing.media !== a.media ||
              existing.url !== a.url ||
              existing.url_key !== a.urlKey ||
              existing.title !== a.title ||
              existing.published_at !== dateSql(a.publishedAt!)
            ) {
              batch.push({ ...base, action: 'quarantine', reason: 'existing_identity_or_metadata_conflict' });
              continue;
            }
            articleId = String(existing.id);
            action = 'linked_existing';
          } else {
            const [result] = await c.query<ResultSetHeader>(
              `INSERT INTO ${names.articles}
              (media,published_at,crawled_at,url,url_key,title,image,category,creator,tags,description,source,content_accessed_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,'legacy',?)`,
              [
                a.media,
                dateSql(a.publishedAt!),
                dateSql(a.crawledAt!),
                a.url,
                a.urlKey,
                a.title,
                a.image,
                a.category,
                a.creator,
                JSON.stringify(a.tags),
                a.description,
                a.description ? dateSql(options.now.toISOString()) : null,
              ],
            );
            if (!Number.isSafeInteger(result.insertId)) throw new Error('Article ID exceeds safe integer range');
            articleId = String(result.insertId);
            if (a.tags.length) {
              // Unicode collation can equate distinct normalized tags. The JSON
              // keeps every spelling; the search index stores one equivalent key.
              await c.query(
                `INSERT INTO ${names.tags} (article_id,tag,published_at) VALUES ? ON DUPLICATE KEY UPDATE published_at=VALUES(published_at)`,
                [a.tags.map((tag) => [articleId, tag, dateSql(a.publishedAt!)])],
              );
            }
            action = 'inserted';
          }
          await c.query(
            `INSERT INTO ${names.origins} (source_key,raw_hash,article_id,generation,source_object,adapter_version,linked_at) VALUES (?,?,?,?,?,'legacy-article-import-v3',?)`,
            [base.sourceKey, base.rawHash, articleId, options.generation, options.object, dateSql(options.now.toISOString())],
          );
          batch.push({ ...base, action, articleId });
        }
        await c.commit();
      } catch (error) {
        await c.rollback();
        throw error;
      }
      outcomes.push(...batch);
      options.onBatch?.(batch);
    }
    return outcomes;
  } finally {
    for (const name of [
      'legacy_input',
      'legacy_origin_input',
      'legacy_dup_urls',
      'legacy_dup_keys',
      'legacy_dry_articles',
      'legacy_dry_origins',
      'legacy_dry_tags',
    ])
      await c.query(`DROP TEMPORARY TABLE IF EXISTS ${name}`);
    await c.query('SELECT RELEASE_LOCK(?)', [lock]);
  }
}
