import { bigint, datetime, index, int, json, longtext, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

// Derived data owned by the new site. Raw crawl tables stay in the legacy DB
// until the crawlers move; nothing here is ever written to the old database.
export const rankingSnapshots = mysqlTable(
  'ranking_snapshots',
  {
    id: int('id').autoincrement().primaryKey(),
    category: varchar('category', { length: 15 }).notNull(),
    hourStart: datetime('hour_start').notNull(),
    computedAt: datetime('computed_at').notNull(),
    hours: int('hours').notNull(),
    weight: int('weight').notNull(),
    mediaCount: int('media_count').notNull(),
    articleCount: int('article_count').notNull(),
    durationMs: int('duration_ms').notNull(),
    chart: longtext('chart').notNull(),
  },
  (t) => [uniqueIndex('ranking_category_hour').on(t.category, t.hourStart), index('ranking_hour').on(t.hourStart)],
);

export const rankingEntries = mysqlTable(
  'ranking_entries',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    snapshotId: int('snapshot_id').notNull(),
    rank: int('rank').notNull(),
    tag: varchar('tag', { length: 60 }).notNull(),
    score: int('score_micro').notNull(),
    count: int('count').notNull(),
    media: json('media').$type<Record<string, number>>().notNull(),
  },
  (t) => [index('entries_snapshot').on(t.snapshotId, t.rank), index('entries_tag').on(t.tag, t.snapshotId)],
);

export const articles = mysqlTable(
  'articles',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    media: varchar('media', { length: 32 }).notNull(),
    mediaId: int('media_id'),
    publishedAt: datetime('published_at').notNull(),
    crawledAt: datetime('crawled_at').notNull(),
    url: varchar('url', { length: 512 }).notNull(),
    urlKey: varchar('url_key', { length: 512 }),
    canonical: varchar('canonical', { length: 512 }),
    title: varchar('title', { length: 512 }).notNull(),
    image: varchar('image', { length: 512 }),
    category: varchar('category', { length: 64 }),
    creator: varchar('creator', { length: 256 }),
    tags: json('tags').$type<string[]>().notNull(),
    description: text('description'),
    fetchedAt: datetime('fetched_at'),
    fetchStatus: varchar('fetch_status', { length: 16 }),
    source: varchar('source', { length: 8 }).notNull().default('own'),
  },
  (t) => [
    uniqueIndex('articles_media_url').on(t.media, t.url),
    uniqueIndex('articles_media_url_key').on(t.media, t.urlKey),
    index('articles_media_id').on(t.media, t.mediaId),
    index('articles_published').on(t.publishedAt),
    index('articles_media_published').on(t.media, t.publishedAt),
    index('articles_media_fetch').on(t.media, t.fetchedAt),
  ],
);

export const articleTags = mysqlTable(
  'article_tags',
  {
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    tag: varchar('tag', { length: 60 }).notNull(),
    publishedAt: datetime('published_at').notNull(),
  },
  (t) => [uniqueIndex('article_tag').on(t.articleId, t.tag), index('tag_published').on(t.tag, t.publishedAt)],
);

export const jobRuns = mysqlTable(
  'job_runs',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    name: varchar('name', { length: 40 }).notNull(),
    startedAt: datetime('started_at').notNull(),
    finishedAt: datetime('finished_at'),
    status: varchar('status', { length: 12 }).notNull(),
    detail: text('detail'),
  },
  (t) => [index('job_runs_name').on(t.name, t.startedAt)],
);

export const crawlRuns = mysqlTable(
  'crawl_runs',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    media: varchar('media', { length: 32 }).notNull(),
    stage: varchar('stage', { length: 8 }).notNull(),
    startedAt: datetime('started_at').notNull(),
    finishedAt: datetime('finished_at'),
    status: varchar('status', { length: 12 }).notNull(),
    fetched: int('fetched').notNull().default(0),
    inserted: int('inserted').notNull().default(0),
    updated: int('updated').notNull().default(0),
    failed: int('failed').notNull().default(0),
    detail: text('detail'),
  },
  (t) => [index('crawl_runs_media').on(t.media, t.startedAt)],
);

// Event clustering (port of legacy maint/events.php + events_history.php + equal3.php).
export const eventSnapshots = mysqlTable(
  'event_snapshots',
  {
    id: int('id').autoincrement().primaryKey(),
    category: varchar('category', { length: 15 }).notNull(),
    hourStart: datetime('hour_start').notNull(),
    computedAt: datetime('computed_at').notNull(),
    rankingSnapshotId: int('ranking_snapshot_id'),
    eventCount: int('event_count').notNull(),
    durationMs: int('duration_ms').notNull(),
    detail: text('detail'),
  },
  (t) => [uniqueIndex('event_snapshot_hour').on(t.category, t.hourStart)],
);

export const events = mysqlTable(
  'events',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    snapshotId: int('snapshot_id').notNull(),
    rank: int('rank').notNull(),
    score: int('score_micro').notNull(),
    tags: json('tags').$type<Array<[string, number]>>().notNull(),
    major: json('major').$type<string[]>().notNull(),
    news: json('news').$type<Array<{ id?: number; title: string; url: string; image: string | null; media: string }>>().notNull(),
    majorNews: json('major_news')
      .$type<Array<{ id?: number; title: string; url: string; image: string | null; media: string }>>()
      .notNull(),
    threadId: bigint('thread_id', { mode: 'number' }),
  },
  (t) => [index('events_snapshot').on(t.snapshotId, t.rank), index('events_thread').on(t.threadId)],
);

export const eventThreads = mysqlTable(
  'event_threads',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    category: varchar('category', { length: 15 }).notNull(),
    firstTime: datetime('first_time').notNull(),
    lastTime: datetime('last_time').notNull(),
    hours: int('hours').notNull(),
    allTags: json('all_tags').$type<string[]>().notNull(),
    majorTags: json('major_tags').$type<string[]>().notNull(),
    maxTag: varchar('max_tag', { length: 60 }),
    maxScore: int('max_score_micro').notNull().default(0),
    history: json('history').$type<Record<string, Record<string, number>>>().notNull(),
    combinedFrom: json('combined_from').$type<number[]>().notNull(),
    combinedTo: json('combined_to').$type<number[]>().notNull(),
    hoursTotal: int('hours_total'),
    equalFirstTime: datetime('equal_first_time'),
    equalLastTime: datetime('equal_last_time'),
  },
  (t) => [index('threads_last').on(t.category, t.lastTime), index('threads_first').on(t.category, t.firstTime)],
);

// Topic listings crawled from media "專題" pages (port of topic/maint/crawler/*_topic.php).
export const topics = mysqlTable(
  'topics',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    media: varchar('media', { length: 32 }).notNull(),
    url: varchar('url', { length: 512 }).notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    image: varchar('image', { length: 512 }),
    category: varchar('category', { length: 64 }),
    firstSeen: datetime('first_seen').notNull(),
    lastSeen: datetime('last_seen').notNull(),
    // The outlet's own stories listed on the topic page ({ key: url_key,
    // title }), used when the topic name maps to no tag (refreshTopicPages).
    pageStories: json('page_keys').$type<Array<{ key: string; title: string }>>(),
    pageCheckedAt: datetime('page_checked_at'),
  },
  (t) => [uniqueIndex('topics_media_url').on(t.media, t.url), index('topics_media_seen').on(t.media, t.firstSeen)],
);

// Tag statistics (port of maint/chart.php `tags` table): per category/level.
export const tagStats = mysqlTable(
  'tag_stats',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    tag: varchar('tag', { length: 60 }).notNull(),
    category: varchar('category', { length: 15 }).notNull(),
    level: int('level').notNull(),
    firstHour: datetime('first_hour').notNull(),
    lastHour: datetime('last_hour').notNull(),
    hoursCount: int('hours_count').notNull(),
    maxHour: datetime('max_hour').notNull(),
    maxCount: int('max_count').notNull(),
    updatedAt: datetime('updated_at').notNull(),
  },
  (t) => [uniqueIndex('tag_stats_key').on(t.tag, t.category, t.level), index('tag_stats_last').on(t.category, t.level, t.lastHour)],
);

// Weekly re-probe of disabled crawl sources (candidate feeds/listings found).
export const sourceProbes = mysqlTable(
  'source_probes',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    media: varchar('media', { length: 32 }).notNull(),
    checkedAt: datetime('checked_at').notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    url: varchar('url', { length: 512 }),
    recentItems: int('recent_items').notNull().default(0),
    detail: text('detail'),
  },
  (t) => [index('source_probes_media').on(t.media, t.checkedAt)],
);

// Listing URLs a source rule rejected after fetching the page (e.g. Yahoo
// articles from partner media). Kept so the listing does not re-insert them.
export const rejectedUrls = mysqlTable(
  'rejected_urls',
  {
    media: varchar('media', { length: 32 }).notNull(),
    urlKey: varchar('url_key', { length: 512 }).notNull(),
    reason: varchar('reason', { length: 64 }).notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (t) => [uniqueIndex('rejected_media_key').on(t.media, t.urlKey), index('rejected_created').on(t.createdAt)],
);
