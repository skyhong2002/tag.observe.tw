import {
  bigint,
  boolean,
  customType,
  date,
  datetime,
  double,
  index,
  int,
  json,
  longtext,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import type { Attribution } from '../similarity/attribution.ts';

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
    summary: text('summary'),
    summarySource: varchar('summary_source', { length: 64 }),
    body: longtext('body'),
    authors: json('authors').$type<string[]>(),
    bodyStatus: varchar('body_status', { length: 16 }),
    bodySource: varchar('body_source', { length: 128 }),
    contentFetchedAt: datetime('content_fetched_at'),
    contentAccessedAt: datetime('content_accessed_at'),
    contentArchiveHash: varchar('content_archive_hash', { length: 64 }),
    contentAttempts: int('content_attempts').notNull().default(0),
    attributions: json('attributions').$type<Attribution[]>(),
    fetchedAt: datetime('fetched_at'),
    fetchStatus: varchar('fetch_status', { length: 16 }),
    source: varchar('source', { length: 8 }).notNull().default('own'),
    // When the similarity index took this article's body; null = not yet.
    similarityAt: datetime('similarity_at'),
  },
  (t) => [
    uniqueIndex('articles_media_url').on(t.media, t.url),
    uniqueIndex('articles_media_url_key').on(t.media, t.urlKey),
    index('articles_media_id').on(t.media, t.mediaId),
    index('articles_published').on(t.publishedAt),
    index('articles_media_published').on(t.media, t.publishedAt),
    index('articles_source_media_published').on(t.source, t.media, t.publishedAt),
    index('articles_media_fetch').on(t.media, t.fetchedAt),
    index('articles_media_content').on(t.media, t.id),
    index('articles_similarity').on(t.similarityAt, t.bodyStatus, t.publishedAt),
  ],
);

// Permanent content-version index; deliberately no cascading FK to articles.
export const articleArchives = mysqlTable(
  'article_archives',
  {
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    objectKey: varchar('object_key', { length: 160 }).notNull(),
    objectHash: varchar('object_hash', { length: 64 }).notNull(),
    archiveRemote: varchar('archive_remote', { length: 512 }).notNull(),
    archivedAt: datetime('archived_at').notNull(),
    verifiedAt: datetime('verified_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.contentHash] }), index('article_archives_verified').on(t.verifiedAt)],
);

export const articleOrigins = mysqlTable(
  'article_origins',
  {
    sourceKey: varchar('source_key', { length: 512 }).notNull(),
    rawHash: varchar('raw_hash', { length: 64 }).notNull(),
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    generation: varchar('generation', { length: 64 }).notNull(),
    sourceObject: varchar('source_object', { length: 512 }).notNull(),
    adapterVersion: varchar('adapter_version', { length: 64 }).notNull(),
    linkedAt: datetime('linked_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sourceKey, t.rawHash] }), index('article_origins_article').on(t.articleId)],
);

const sketchBytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'varbinary(512)' });

// One row per indexed article with a comparable body, kept permanently as the
// record that it was analysed. The MinHash sketch (similarity/minhash.ts) is
// cleared with the body; until then later articles are compared with it.
export const articleSketches = mysqlTable(
  'article_sketches',
  {
    articleId: bigint('article_id', { mode: 'number' }).primaryKey(),
    media: varchar('media', { length: 32 }).notNull(),
    publishedAt: datetime('published_at').notNull(),
    // Normalized body length, shown with each compared article.
    chars: int('chars').notNull(),
    sketch: sketchBytes('sketch'),
  },
  (t) => [index('sketches_published').on(t.publishedAt)],
);

// Every cross-media body pair at Dice ≥ 0.5, kept permanently. a_id < b_id;
// `day` is the Taipei date of the later publication.
export const similarityPairs = mysqlTable(
  'similarity_pairs',
  {
    aId: bigint('a_id', { mode: 'number' }).notNull(),
    bId: bigint('b_id', { mode: 'number' }).notNull(),
    aMedia: varchar('a_media', { length: 32 }).notNull(),
    bMedia: varchar('b_media', { length: 32 }).notNull(),
    aPublished: datetime('a_published').notNull(),
    bPublished: datetime('b_published').notNull(),
    firstPublished: datetime('first_published').notNull(),
    lastPublished: datetime('last_published').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    score: double('score').notNull(),
    containment: double('containment').notNull(),
    shared: int('shared').notNull(),
    kind: varchar('kind', { length: 10 }).notNull(),
    evidence: varchar('evidence', { length: 100 }).notNull(),
    computedAt: datetime('computed_at').notNull(),
  },
  (t) => [
    primaryKey({ name: 'similarity_pairs_pk', columns: [t.aId, t.bId] }),
    index('pairs_b').on(t.bId),
    index('pairs_last').on(t.lastPublished, t.firstPublished),
    index('pairs_day').on(t.day, t.score),
  ],
);

// Explicit citations of other outlets from indexed articles, one row per
// cited outlet, so daily counts do not have to parse article JSON.
export const articleCitations = mysqlTable(
  'article_citations',
  {
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    source: varchar('source', { length: 255 }).notNull(),
    media: varchar('media', { length: 32 }).notNull(),
    publishedAt: datetime('published_at').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
  },
  (t) => [
    primaryKey({ name: 'article_citations_pk', columns: [t.articleId, t.source] }),
    index('citations_published').on(t.publishedAt),
    index('citations_day').on(t.day, t.media),
  ],
);

// Discovery attribution is independent of the article's publishing outlet.
export const articleDiscoveries = mysqlTable(
  'article_discoveries',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    media: varchar('media', { length: 32 }).notNull(),
    discoveryUrl: text('discovery_url').notNull(),
    discoveredAt: datetime('discovered_at').notNull(),
  },
  (t) => [uniqueIndex('discovery_article_media').on(t.articleId, t.media), index('discovery_media_article').on(t.media, t.articleId)],
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
    // title, date? — ISO date the page shows for it }), used when the topic
    // name maps to no tag and to date the topic (refreshTopicPages).
    pageStories: json('page_keys').$type<Array<{ key: string; title: string; date?: string; url?: string }>>(),
    pageCheckedAt: datetime('page_checked_at'),
    // 'topic' (議題, keeps gaining stories) or 'feature' (專題, a one-off
    // package); 'article' is a confirmed single report retained only for redirects.
    // kind_source 'article' preserves this classification across listing refreshes; 'rule' = declared by the listing, never
    // overwritten by the story-date classification ('auto'); NULL = unclassified.
    kind: varchar('kind', { length: 16 }).notNull().default('topic'),
    kindSource: varchar('kind_source', { length: 8 }),
    sponsored: boolean('sponsored').notNull().default(false),
    // Sub-topic listed on its parent topic's page (CNA 5056 → 5100–5106).
    parentId: bigint('parent_id', { mode: 'number' }),
    storyFirstAt: datetime('story_first_at'),
    storyLastAt: datetime('story_last_at'),
    storyCount: int('story_count'),
    // Last time a page refresh found a story key not stored before.
    storyGrewAt: datetime('story_grew_at'),
    // Already listed when its source was first crawled: first_seen is not a start date.
    backlog: boolean('backlog').notNull().default(false),
  },
  (t) => [
    uniqueIndex('topics_media_url').on(t.media, t.url),
    index('topics_media_seen').on(t.media, t.firstSeen),
    index('topics_kind_media_seen').on(t.kind, t.media, t.firstSeen),
  ],
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

// Daily GA4 / Search Console aggregates (jobs/analytics-job.ts). One row per
// (day, source, metric, key); key is '' for site totals, else a channel,
// device, event name, page path or 'LCP:good'. label keeps a page's title.
export const siteMetrics = mysqlTable(
  'site_metrics',
  {
    day: date('day', { mode: 'string' }).notNull(),
    source: varchar('source', { length: 8 }).notNull(),
    metric: varchar('metric', { length: 24 }).notNull(),
    key: varchar('key', { length: 255 }).notNull().default(''),
    value: double('value').notNull(),
    label: varchar('label', { length: 255 }),
  },
  (t) => [primaryKey({ columns: [t.day, t.source, t.metric, t.key] }), index('site_metrics_metric_day').on(t.source, t.metric, t.day)],
);

// Google sign-in (app/src/auth). Roles are not stored: admins are whoever is
// listed in TAG_ADMIN_EMAILS at request time. Sessions keep only a SHA-256 of
// the cookie value.
export const users = mysqlTable(
  'users',
  {
    id: int('id').autoincrement().primaryKey(),
    googleSub: varchar('google_sub', { length: 64 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    picture: varchar('picture', { length: 512 }),
    createdAt: datetime('created_at').notNull(),
    lastLoginAt: datetime('last_login_at').notNull(),
  },
  (t) => [uniqueIndex('users_google_sub').on(t.googleSub), index('users_email').on(t.email)],
);

export const userSessions = mysqlTable(
  'user_sessions',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    userId: int('user_id').notNull(),
    createdAt: datetime('created_at').notNull(),
    expiresAt: datetime('expires_at').notNull(),
  },
  (t) => [index('user_sessions_user').on(t.userId), index('user_sessions_expires').on(t.expiresAt)],
);

// Media labels (藍營、綠營、新聞、非主流…), editable from /admin/media/.
// Seeded once from app/data/media-catalog.json; the DB is the source of truth
// afterwards (app/src/media-categories.ts).
export const mediaCategoryDefs = mysqlTable('media_category_defs', {
  key: varchar('key', { length: 32 }).primaryKey(),
  label: varchar('label', { length: 64 }).notNull(),
  sort: int('sort').notNull().default(0),
  createdAt: datetime('created_at').notNull(),
});

export const mediaCategories = mysqlTable(
  'media_categories',
  {
    media: varchar('media', { length: 32 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.media, t.category] }), index('media_categories_category').on(t.category)],
);

export const mediaCategoryLog = mysqlTable(
  'media_category_log',
  {
    id: int('id').autoincrement().primaryKey(),
    media: varchar('media', { length: 32 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    action: varchar('action', { length: 8 }).$type<'add' | 'remove' | 'create'>().notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('media_category_log_media').on(t.media, t.at)],
);

// Similarweb and Cloudflare Radar history (app/src/media-traffic/history.ts).
// The JSON snapshots under ~/.local/share only hold the latest batch; these
// tables keep every month and every Radar period ever seen, so the record
// grows like the old GeneHong sheet and is covered by the database backup.
// A revised value overwrites the row; first_seen_at keeps when it first appeared.
export const mediaTrafficMonths = mysqlTable(
  'media_traffic_months',
  {
    domain: varchar('domain', { length: 255 }).notNull(),
    month: varchar('month', { length: 6 }).notNull(),
    visits: bigint('visits', { mode: 'number' }).notNull(),
    firstSeenAt: datetime('first_seen_at').notNull(),
    fetchedAt: datetime('fetched_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.month] }), index('media_traffic_months_month').on(t.month)],
);

export const mediaTrafficProfiles = mysqlTable(
  'media_traffic_profiles',
  {
    domain: varchar('domain', { length: 255 }).notNull(),
    month: varchar('month', { length: 6 }).notNull(),
    /** TrafficProfile: countries, channels, engagement and ranks for the month. */
    profile: json('profile').notNull(),
    firstSeenAt: datetime('first_seen_at').notNull(),
    fetchedAt: datetime('fetched_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.month] })],
);

export const mediaRadarRanks = mysqlTable(
  'media_radar_ranks',
  {
    domain: varchar('domain', { length: 255 }).notNull(),
    /** End of the Radar reporting period; one row per period. */
    dateEnd: datetime('date_end').notNull(),
    dateStart: datetime('date_start').notNull(),
    rank: int('rank'),
    bucket: int('bucket'),
    bucketLowerBound: int('bucket_lower_bound'),
    firstSeenAt: datetime('first_seen_at').notNull(),
    fetchedAt: datetime('fetched_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.dateEnd] }), index('media_radar_ranks_date').on(t.dateEnd)],
);
