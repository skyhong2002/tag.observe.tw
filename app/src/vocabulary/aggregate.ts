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
      for (const t of terms) insert.run(t.tag, t.groupKey, t.articleCount, t.firstPublishedAt, t.lastPublishedAt);
      this.db.prepare('DELETE FROM pending WHERE group_key=?').run(key);
    });
  }
  recordChanges(old: string[], terms: AggregateTerm[]) {
    const next = new Set(terms.map((t) => t.tag));
    const put = this.db.prepare('INSERT OR REPLACE INTO changes VALUES(?,?,?)');
    for (const label of old) if (!next.has(label)) put.run(label, 'absent-from-index', JSON.stringify({ label }));
    const get = this.db.prepare('SELECT n,first_at,last_at FROM terms WHERE label=?');
    for (const t of terms) {
      const previous = get.get(t.tag);
      if (
        !previous ||
        Number(previous.n) !== t.articleCount ||
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
    this.transaction(() => {
      const previous = this.get<string>('activityCheckedAt');
      if (previous) {
        const lower = new Date(Date.parse(previous) - 180 * 86400000).toISOString(),
          upper = new Date(now.getTime() - 180 * 86400000).toISOString();
        const put = this.db.prepare('INSERT OR REPLACE INTO changes VALUES(?,?,?)');
        for (const row of this.db
          .prepare('SELECT label,n,first_at,last_at FROM terms WHERE n<3 AND last_at>=? AND last_at<?')
          .iterate(lower, upper))
          put.run(
            String(row.label),
            'upsert',
            JSON.stringify({ tag: row.label, articleCount: row.n, firstPublishedAt: row.first_at, lastPublishedAt: row.last_at }),
          );
      }
      this.set('activityCheckedAt', now.toISOString());
    });
  }
  beginGroup() {
    this.db.exec('DELETE FROM group_work');
  }
  stageGroup(rows: RowDataPacket[], checkpoint: unknown) {
    this.transaction(() => {
      const insert = this.db.prepare(
        `INSERT INTO group_work VALUES(?,?,1,?,?) ON CONFLICT(label) DO UPDATE SET n=n+1,first_at=MIN(first_at,excluded.first_at),last_at=MAX(last_at,excluded.last_at)`,
      );
      for (const r of rows) {
        const at = new Date(r.published_at.replace(' ', 'T') + 'Z').toISOString();
        insert.run(r.tag, r.groupKey, at, at);
      }
      this.set('largeGroup', checkpoint);
    });
  }
  groupTerms(): AggregateTerm[] {
    return this.db
      .prepare('SELECT * FROM group_work')
      .all()
      .map((r) => ({
        tag: String(r.label),
        groupKey: String(r.group_key),
        articleCount: Number(r.n),
        firstPublishedAt: String(r.first_at),
        lastPublishedAt: String(r.last_at),
      }));
  }
  *terms(): Generator<SourceTerm> {
    for (const r of this.db.prepare('SELECT label,n,first_at,last_at FROM terms ORDER BY label COLLATE BINARY').iterate())
      yield { tag: String(r.label), articleCount: Number(r.n), firstPublishedAt: String(r.first_at), lastPublishedAt: String(r.last_at) };
  }
  count() {
    return Number(this.db.prepare('SELECT COUNT(*) n FROM terms').get()!.n);
  }
  close() {
    this.db.close();
  }
}
