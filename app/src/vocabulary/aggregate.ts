import { DatabaseSync } from 'node:sqlite';
import type { RowDataPacket } from 'mysql2/promise';
import type { SourceTerm } from './snapshots.ts';
import type { AggregateTerm } from './source.ts';
export class VocabularyAggregate {
  readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA cache_size=-16384;
 CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS terms(label TEXT COLLATE BINARY PRIMARY KEY,group_key TEXT NOT NULL,n INTEGER NOT NULL,first_at TEXT NOT NULL,last_at TEXT NOT NULL) WITHOUT ROWID;
 CREATE INDEX IF NOT EXISTS terms_group ON terms(group_key);
 CREATE INDEX IF NOT EXISTS terms_last ON terms(last_at);
 CREATE TABLE IF NOT EXISTS pending(group_key TEXT PRIMARY KEY,tag TEXT NOT NULL,priority INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS pending_priority ON pending(priority DESC);
 CREATE TABLE IF NOT EXISTS seen(article_id INTEGER NOT NULL,tag TEXT COLLATE BINARY NOT NULL,at TEXT NOT NULL,PRIMARY KEY(article_id,tag)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS changes(label TEXT COLLATE BINARY PRIMARY KEY,action TEXT NOT NULL,payload TEXT NOT NULL) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS group_recent(label TEXT COLLATE BINARY PRIMARY KEY,r30 INTEGER NOT NULL,r90 INTEGER NOT NULL,r180 INTEGER NOT NULL,as_of TEXT NOT NULL) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS recent_counts(label TEXT COLLATE BINARY PRIMARY KEY,r30 INTEGER NOT NULL,r90 INTEGER NOT NULL,r180 INTEGER NOT NULL,as_of TEXT NOT NULL) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS group_work(label TEXT COLLATE BINARY PRIMARY KEY,group_key TEXT NOT NULL,n INTEGER NOT NULL,first_at TEXT NOT NULL,last_at TEXT NOT NULL) WITHOUT ROWID;`);
  }
  get<T>(key: string): T | null {
    const r = this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key);
    return r ? JSON.parse(String(r.value)) : null;
  }
  set(key: string, value: unknown) {
    this.db.prepare('INSERT INTO metadata VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
  }
  transaction(run: () => void) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      run();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  replace(afterKey: string | null, upperKey: string | null, terms: AggregateTerm[], checkpoint?: { key: string; value: unknown }) {
    this.transaction(() => {
      const where =
        afterKey === null ? (upperKey === null ? '1' : 'group_key<=?') : upperKey === null ? 'group_key>?' : 'group_key>? AND group_key<=?';
      const args = [afterKey, upperKey].filter((x) => x !== null);
      const old = this.db.prepare('SELECT label FROM terms WHERE ' + where).all(...args);
      this.recordChanges(
        old.map((r) => String(r.label)),
        terms,
      );
      this.db.prepare('DELETE FROM terms WHERE ' + where).run(...args);
      const insert = this.db.prepare('INSERT OR REPLACE INTO terms VALUES(?,?,?,?,?)');
      this.saveRecent(terms);
      for (const t of terms) insert.run(t.tag, t.groupKey, t.articleCount, t.firstPublishedAt, t.lastPublishedAt);
      if (checkpoint) this.set(checkpoint.key, checkpoint.value);
    });
  }
  replaceExact(key: string, terms: AggregateTerm[]) {
    this.transaction(() => {
      const old = this.db.prepare('SELECT label FROM terms WHERE group_key=?').all(key);
      this.recordChanges(
        old.map((r) => String(r.label)),
        terms,
      );
      this.db.prepare('DELETE FROM terms WHERE group_key=?').run(key);
      const insert = this.db.prepare('INSERT OR REPLACE INTO terms VALUES(?,?,?,?,?)');
      this.saveRecent(terms);
      for (const t of terms) insert.run(t.tag, t.groupKey, t.articleCount, t.firstPublishedAt, t.lastPublishedAt);
      this.db.prepare('DELETE FROM pending WHERE group_key=?').run(key);
    });
  }
  saveRecent(terms: AggregateTerm[]) {
    const put = this.db.prepare('INSERT OR REPLACE INTO recent_counts VALUES(?,?,?,?,?)');
    const remove = this.db.prepare('DELETE FROM recent_counts WHERE label=?');
    for (const t of terms) {
      if (t.recentArticleCounts)
        put.run(t.tag, t.recentArticleCounts['30'], t.recentArticleCounts['90'], t.recentArticleCounts['180'], t.recentCountsAsOf!);
      else remove.run(t.tag);
    }
  }
  recordChanges(old: string[], terms: AggregateTerm[]) {
    const next = new Set(terms.map((t) => t.tag));
    const put = this.db.prepare('INSERT OR REPLACE INTO changes VALUES(?,?,?)');
    for (const label of old)
      if (!next.has(label)) {
        put.run(label, 'absent-from-index', JSON.stringify({ label }));
        this.db.prepare('DELETE FROM recent_counts WHERE label=?').run(label);
      }
    const get = this.db.prepare('SELECT n,first_at,last_at,r30,r90,r180 FROM terms LEFT JOIN recent_counts USING(label) WHERE label=?');
    for (const t of terms) {
      const previous = get.get(t.tag);
      if (
        !previous ||
        Number(previous.n) !== t.articleCount ||
        Number(previous.r30 ?? 0) !== (t.recentArticleCounts?.['30'] ?? 0) ||
        Number(previous.r90 ?? 0) !== (t.recentArticleCounts?.['90'] ?? 0) ||
        Number(previous.r180 ?? 0) !== (t.recentArticleCount ?? 0) ||
        previous.first_at !== t.firstPublishedAt ||
        previous.last_at !== t.lastPublishedAt
      )
        put.run(t.tag, 'upsert', JSON.stringify(t));
    }
  }
  observe(rows: RowDataPacket[], baseline: string) {
    let changed = 0;
    this.transaction(() => {
      const get = this.db.prepare('SELECT at FROM seen WHERE article_id=? AND tag=?');
      const put = this.db.prepare('INSERT OR REPLACE INTO seen VALUES(?,?,?)');
      const pending = this.db.prepare(
        'INSERT INTO pending VALUES(?,?,?) ON CONFLICT(group_key) DO UPDATE SET tag=excluded.tag,priority=MAX(priority,excluded.priority)',
      );
      for (const r of rows) {
        const prior = get.get(r.article_id, r.tag);
        if (!prior || prior.at !== r.published_at) {
          put.run(r.article_id, r.tag, r.published_at);
          if (BigInt(r.article_id) > BigInt(baseline)) {
            pending.run(r.groupKey, r.tag, r.article_id);
            changed++;
            if (!this.get('firstNewTagObservedAt')) this.set('firstNewTagObservedAt', Date.now());
          }
        }
      }
      const last = rows.at(-1);
      if (last) this.set('newCursor', { id: String(last.article_id), tag: last.tag });
    });
    return changed;
  }
  queueActiveExpiry(now: Date) {
    // Recompute all windows when the last article exits the active 30-day window.
    // Partial count changes remain covered by rolling reconciliation.
    this.transaction(() => {
      const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString();
      const previous = this.get<string>('active30CheckedAt');
      const lower = previous ? new Date(Date.parse(previous) - 30 * 86400000).toISOString() : '';
      const queue = this.db.prepare('INSERT INTO pending VALUES(?,?,0) ON CONFLICT(group_key) DO NOTHING');
      for (const row of this.db
        .prepare('SELECT t.label,group_key FROM terms t JOIN recent_counts r ON r.label=t.label WHERE r30>0 AND last_at>=? AND last_at<?')
        .all(lower, cutoff))
        queue.run(String(row.group_key), String(row.label));
      this.set('active30CheckedAt', now.toISOString());
    });
  }
  beginGroup() {
    this.db.exec('DELETE FROM group_work; DELETE FROM group_recent');
  }
  stageGroup(rows: RowDataPacket[], checkpoint: unknown, asOf = new Date()) {
    this.transaction(() => {
      const insert = this.db.prepare(
        `INSERT INTO group_work VALUES(?,?,1,?,?) ON CONFLICT(label) DO UPDATE SET n=n+1,first_at=MIN(first_at,excluded.first_at),last_at=MAX(last_at,excluded.last_at)`,
      );
      const recent = this.db.prepare(
        'INSERT INTO group_recent VALUES(?,?,?,?,?) ON CONFLICT(label) DO UPDATE SET r30=r30+excluded.r30,r90=r90+excluded.r90,r180=r180+excluded.r180',
      );
      for (const r of rows) {
        const at = new Date(r.published_at.replace(' ', 'T') + 'Z').toISOString();
        insert.run(r.tag, r.groupKey, at, at);
        const age = asOf.getTime() - Date.parse(at);
        recent.run(r.tag, ...[30, 90, 180].map((d) => Number(age >= 0 && age <= d * 86400000)), asOf.toISOString());
      }
      this.set('largeGroup', checkpoint);
    });
  }
  groupTerms(): AggregateTerm[] {
    return this.db
      .prepare('SELECT * FROM group_work LEFT JOIN group_recent USING(label)')
      .all()
      .map((r) => ({
        tag: String(r.label),
        groupKey: String(r.group_key),
        articleCount: Number(r.n),
        recentArticleCount: Number(r.r180),
        recentArticleCounts: { '30': Number(r.r30), '90': Number(r.r90), '180': Number(r.r180) },
        recentCountsAsOf: String(r.as_of),
        firstPublishedAt: String(r.first_at),
        lastPublishedAt: String(r.last_at),
      }));
  }
  *terms(): Generator<SourceTerm> {
    const fallback = this.get<string>('recentHydrationAsOf') ?? this.get<string>('startedAt');
    const complete = this.get('recentHydrationComplete') || this.get('recentCountsReady');
    for (const r of this.db
      .prepare(
        'SELECT t.label,n,first_at,last_at,r30,r90,r180,as_of FROM terms t LEFT JOIN recent_counts r ON r.label=t.label ORDER BY t.label COLLATE BINARY',
      )
      .iterate())
      yield {
        tag: String(r.label),
        articleCount: Number(r.n),
        firstPublishedAt: String(r.first_at),
        lastPublishedAt: String(r.last_at),
        ...(r.as_of || complete
          ? {
              recentArticleCount: Number(r.r180 ?? 0),
              recentArticleCounts: { '30': Number(r.r30 ?? 0), '90': Number(r.r90 ?? 0), '180': Number(r.r180 ?? 0) },
              recentCountsAsOf: String(r.as_of ?? fallback),
            }
          : {}),
      };
  }
  count() {
    return Number(this.db.prepare('SELECT COUNT(*) n FROM terms').get()!.n);
  }
  close() {
    this.db.close();
  }
}
