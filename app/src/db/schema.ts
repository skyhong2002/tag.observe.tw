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

// Google sign-in (app/src/auth). Admins are whoever is listed in
// TAG_ADMIN_EMAILS at request time, plus accounts another admin promoted from
// /admin/ (admin_granted_*). Sessions keep only a SHA-256 of the cookie value.
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
    adminGrantedBy: varchar('admin_granted_by', { length: 255 }),
    adminGrantedAt: datetime('admin_granted_at'),
  },
  (t) => [uniqueIndex('users_google_sub').on(t.googleSub), index('users_email').on(t.email)],
);

// Every promotion or demotion made from /admin/.
export const userRoleLog = mysqlTable(
  'user_role_log',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    role: varchar('role', { length: 8 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('user_role_log_user').on(t.userId, t.at)],
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
    /** similarweb: fetched by the worker; genehong: seeded from the GeneHong sheet
     *  (millions, rounded) for months fetched before the worker existed. Similarweb wins. */
    source: varchar('source', { length: 16 }).$type<'similarweb' | 'genehong'>().notNull().default('similarweb'),
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

// Articles whose tags an admin set by hand at /admin/media/: crawls leave
// their tags alone until an admin re-fetches the page (app/src/admin/routes.ts).
export const articleTagEdits = mysqlTable('article_tag_edits', {
  articleId: bigint('article_id', { mode: 'number' }).primaryKey(),
  editedAt: datetime('edited_at').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
});

export const articleTagLog = mysqlTable(
  'article_tag_log',
  {
    id: int('id').autoincrement().primaryKey(),
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    tag: varchar('tag', { length: 60 }).notNull(),
    action: varchar('action', { length: 8 }).$type<'add' | 'remove'>().notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('article_tag_log_article').on(t.articleId, t.at)],
);

// Admin corrections to Similarweb's Taiwan share (app/src/media-traffic/taiwan-share.ts),
// edited on /media/traffic/. One value per outlet, used for every month until
// cleared; the log keeps every change with who made it and why.
export const mediaTaiwanShares = mysqlTable('media_taiwan_shares', {
  media: varchar('media', { length: 32 }).primaryKey(),
  /** Taiwan's share of the outlet's visits, 0–1. */
  share: double('share').notNull(),
  note: varchar('note', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const mediaTaiwanShareLog = mysqlTable(
  'media_taiwan_share_log',
  {
    id: int('id').autoincrement().primaryKey(),
    media: varchar('media', { length: 32 }).notNull(),
    /** null: no correction before / the correction was cleared. */
    before: double('before'),
    after: double('after'),
    note: varchar('note', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('media_taiwan_share_log_media').on(t.media, t.at)],
);

// Reader accounts (app/src/reader/, docs/login.md#讀者功能): what a signed-in
// reader follows, saves, prefers and reports. Every row belongs to one user.
export const userFollows = mysqlTable(
  'user_follows',
  {
    userId: int('user_id').notNull(),
    kind: varchar('kind', { length: 16 }).$type<'tag' | 'media' | 'journalist' | 'event'>().notNull(),
    /** Tag text, media key, journalist name, or event thread id as a string. */
    target: varchar('target', { length: 255 }).notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.target] })],
);

export const userSaves = mysqlTable(
  'user_saves',
  {
    userId: int('user_id').notNull(),
    kind: varchar('kind', { length: 8 }).$type<'article' | 'event'>().notNull(),
    targetId: bigint('target_id', { mode: 'number' }).notNull(),
    note: varchar('note', { length: 500 }),
    createdAt: datetime('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.targetId] }), index('user_saves_user_created').on(t.userId, t.createdAt)],
);

export const userPrefs = mysqlTable('user_prefs', {
  userId: int('user_id').primaryKey(),
  prefs: json('prefs').$type<Record<string, unknown>>().notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// The token in a reader's private RSS URL. Kept as is so /my/settings/ can show
// the URL again; it only reveals what the reader follows.
export const userFeedTokens = mysqlTable(
  'user_feed_tokens',
  {
    userId: int('user_id').primaryKey(),
    token: varchar('token', { length: 64 }).notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (t) => [uniqueIndex('user_feed_tokens_token').on(t.token)],
);

// Personal API keys: only a SHA-256 is stored; the key is shown once.
export const userApiKeys = mysqlTable(
  'user_api_keys',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    /** The key's first characters, so the reader can tell keys apart. */
    prefix: varchar('prefix', { length: 16 }).notNull(),
    label: varchar('label', { length: 64 }).notNull(),
    createdAt: datetime('created_at').notNull(),
    lastUsedAt: datetime('last_used_at'),
    revokedAt: datetime('revoked_at'),
  },
  (t) => [uniqueIndex('user_api_keys_hash').on(t.keyHash), index('user_api_keys_user').on(t.userId)],
);

// Opt-in reading history behind /my/reading/; turning it off deletes the rows.
export const readerHistory = mysqlTable(
  'reader_history',
  {
    userId: int('user_id').notNull(),
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    readAt: datetime('read_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.articleId] }), index('reader_history_user_read').on(t.userId, t.readAt)],
);

// Readers' corrections (wrong tags, byline, outlet…), reviewed at /admin/.
export const readerReports = mysqlTable(
  'reader_reports',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    kind: varchar('kind', { length: 16 }).$type<'tags' | 'byline' | 'media' | 'other'>().notNull(),
    /** For kind = tags: the full tag list the reader suggests. */
    tags: json('tags').$type<string[]>(),
    message: varchar('message', { length: 1000 }).notNull(),
    status: varchar('status', { length: 10 }).$type<'open' | 'accepted' | 'rejected'>().notNull().default('open'),
    createdAt: datetime('created_at').notNull(),
    resolvedAt: datetime('resolved_at'),
    resolvedBy: varchar('resolved_by', { length: 255 }),
    resolution: varchar('resolution', { length: 255 }),
  },
  (t) => [index('reader_reports_status').on(t.status, t.createdAt), index('reader_reports_user').on(t.userId, t.createdAt)],
);

// Articles whose byline an admin set by hand at /admin/media/: crawls and the
// author repair tools leave articles.authors/creator alone until an admin
// re-fetches the page (app/src/admin/routes.ts).
export const articleAuthorEdits = mysqlTable('article_author_edits', {
  articleId: bigint('article_id', { mode: 'number' }).primaryKey(),
  editedAt: datetime('edited_at').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
});

export const articleAuthorLog = mysqlTable(
  'article_author_log',
  {
    id: int('id').autoincrement().primaryKey(),
    articleId: bigint('article_id', { mode: 'number' }).notNull(),
    before: json('before').$type<string[]>().notNull(),
    after: json('after').$type<string[]>().notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('article_author_log_article').on(t.articleId, t.at)],
);

// Person tags matched to Wikidata, with a sketch avatar (docs/tag-avatars.md).
// tools/tag-avatars.ts fills these; admins switch or hide avatars at
// /admin/avatars/. status: auto = best candidate shown; review = shown but
// an admin should look (low score, namesakes); chosen = an admin picked one;
// hidden = an admin turned the avatar off; nophoto = a person with no usable
// photo; none = no Wikidata person by this exact name; nonhuman = admin
// rejected the person identity (even forced rechecks preserve it); voted = readers
// uploaded or voted, and the candidate with the most votes is shown
// (docs/tag-pictures.md). chosen and hidden are an admin's override.
export type TagPersonStatus = 'auto' | 'review' | 'chosen' | 'hidden' | 'nophoto' | 'none' | 'voted' | 'nonhuman';
export type TagPersonFacts = {
  citizenship: string[];
  occupations: string[];
  parties: string[];
  positions: { label: string; current: boolean }[];
};

export const tagPeople = mysqlTable(
  'tag_people',
  {
    tag: varchar('tag', { length: 60 }).primaryKey(),
    wikidataId: varchar('wikidata_id', { length: 16 }),
    label: varchar('label', { length: 120 }),
    description: varchar('description', { length: 255 }),
    facts: json('facts').$type<TagPersonFacts>(),
    status: varchar('status', { length: 8 }).$type<TagPersonStatus>().notNull(),
    // Why status is review/nophoto, e.g. 「最高分 0.42」「同名 2 人」.
    note: varchar('note', { length: 120 }),
    // tag_avatar_candidates.rank on show; null when nothing is shown.
    shownRank: int('shown_rank'),
    checkedAt: datetime('checked_at').notNull(),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    reviewedAt: datetime('reviewed_at'),
  },
  (t) => [index('tag_people_status').on(t.status, t.checkedAt), index('tag_people_wikidata').on(t.wikidataId)],
);

const imageBytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'mediumblob' });

// Semantic relations and reader pictures share the existing tag admin's review
// queue. No writes or triggers on crawl tables. Private author/review details
// are deliberately separate from the public projection.
export const tagSubmissions = mysqlTable(
  'tag_submissions',
  {
    id: int('id').autoincrement().primaryKey(),
    kind: varchar('kind', { length: 16 }).$type<'relation' | 'picture'>().notNull(),
    tag: varchar('tag', { length: 60 }).notNull(),
    relationType: varchar('relation_type', { length: 16 }).$type<'is-a' | 'related' | 'alias'>(),
    target: varchar('target', { length: 60 }),
    targetGroupId: int('target_group_id'),
    reason: varchar('reason', { length: 1000 }),
    status: varchar('status', { length: 16 }).$type<'pending' | 'approved' | 'rejected' | 'revoked'>().notNull(),
    source: varchar('source', { length: 16 }).$type<'submission' | 'manual' | 'rule'>().notNull(),
    createdBy: int('created_by').notNull(),
    createdAt: datetime('created_at').notNull(),
    reviewedBy: int('reviewed_by'),
    reviewedAt: datetime('reviewed_at'),
    reviewReason: varchar('review_reason', { length: 1000 }),
    dedupeKey: varchar('dedupe_key', { length: 64 }).notNull(),
    pictureKind: varchar('picture_kind', { length: 16 }).$type<'avatar' | 'visual'>(),
    image: imageBytes('image'),
    pictureMeta: json('picture_meta').$type<{ score: number; scores: Record<string, number>; verdict: string }>(),
    rightsConfirmed: boolean('rights_confirmed').notNull().default(false),
    candidateRank: int('candidate_rank'),
  },
  (t) => [
    uniqueIndex('tag_submission_dedupe').on(t.dedupeKey),
    index('tag_submission_queue').on(t.status, t.id),
    index('tag_submission_outgoing').on(t.tag, t.kind, t.status),
    index('tag_submission_incoming').on(t.target, t.kind, t.status),
    index('tag_submission_author').on(t.createdBy, t.createdAt),
  ],
);

export const tagSubmissionLog = mysqlTable(
  'tag_submission_log',
  {
    id: int('id').autoincrement().primaryKey(),
    submissionId: int('submission_id').notNull(),
    action: varchar('action', { length: 16 }).$type<'submit' | 'approved' | 'rejected' | 'auto-approved' | 'revoked'>().notNull(),
    userId: int('user_id').notNull(),
    at: datetime('at').notNull(),
    reason: varchar('reason', { length: 1000 }),
  },
  (t) => [index('tag_submission_history').on(t.submissionId, t.id)],
);

// Serializes only semantic edge approval, so simultaneous A→B / B→A reviews
// cannot introduce a cycle. It never participates in crawler transactions.
export const tagRelationLock = mysqlTable('tag_relation_lock', { id: int('id').primaryKey() });

// Up to three best photos per person tag, best first, each already rendered
// as a 256px WebP sketch. The photo itself is not kept; page_url and the
// license fields are the Commons attribution shown with the avatar.
export const tagAvatarCandidates = mysqlTable(
  'tag_avatar_candidates',
  {
    tag: varchar('tag', { length: 60 }).notNull(),
    rank: int('rank').notNull(),
    file: varchar('file', { length: 255 }).notNull(),
    pageUrl: varchar('page_url', { length: 512 }).notNull(),
    license: varchar('license', { length: 64 }),
    licenseUrl: varchar('license_url', { length: 255 }),
    artist: varchar('artist', { length: 255 }),
    score: double('score').notNull(),
    scores: json('scores').$type<Record<string, number>>().notNull(),
    // ok, or bystander: another face sits inside the crop.
    verdict: varchar('verdict', { length: 10 }).notNull(),
    image: imageBytes('image').notNull(),
    // A reader's upload (users.id); null for Commons photos and admin uploads.
    uploadedBy: int('uploaded_by'),
    uploadedAt: datetime('uploaded_at'),
  },
  (t) => [primaryKey({ columns: [t.tag, t.rank] })],
);

export const tagPeopleLog = mysqlTable(
  'tag_people_log',
  {
    id: int('id').autoincrement().primaryKey(),
    tag: varchar('tag', { length: 60 }).notNull(),
    action: varchar('action', { length: 8 }).$type<'show' | 'hide' | 'nonhuman'>().notNull(),
    fromRank: int('from_rank'),
    toRank: int('to_rank'),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('tag_people_log_tag').on(t.tag, t.at)],
);

// How each article was written (app/src/writing/, /writing/): whether its lead
// retells a social-media post, who posted, and its headline wording. One row
// per analysed article, kept after the body expires so trends stay comparable;
// `version` names the rule set (writing/rules.ts) that produced the row.
export const articleWriting = mysqlTable(
  'article_writing',
  {
    articleId: bigint('article_id', { mode: 'number' }).primaryKey(),
    media: varchar('media', { length: 32 }).notNull(),
    publishedAt: datetime('published_at').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    version: varchar('version', { length: 16 }).notNull(),
    /** null: the lead does not retell a post. */
    platform: varchar('platform', { length: 16 }),
    /** The clause naming the poster plus the posting phrase, as printed. */
    evidence: varchar('evidence', { length: 200 }),
    poster: varchar('poster', { length: 40 }),
    role: varchar('role', { length: 16 }),
    /** Multiple speaker labels; null falls back to the legacy role. */
    roles: json('roles').$type<string[]>(),
    /** clause: title words next to the post; people: writing_people. */
    roleSource: varchar('role_source', { length: 8 }).$type<'clause' | 'people'>(),
    titleTags: json('title_tags').$type<string[]>().notNull(),
    analyzedAt: datetime('analyzed_at').notNull(),
  },
  (t) => [
    index('article_writing_day').on(t.day, t.media),
    index('article_writing_media').on(t.media, t.day),
    index('article_writing_poster').on(t.poster),
    index('article_writing_version').on(t.version, t.publishedAt),
  ],
);

// Poster names and the role they usually carry in article text (「前立委邱毅」),
// so a bare 「邱毅今天在臉書…」 can still be classified. source 'auto' rows are
// rebuilt daily from recent bodies; 'admin' rows are corrections and win.
export const writingPeople = mysqlTable('writing_people', {
  name: varchar('name', { length: 40 }).primaryKey(),
  role: varchar('role', { length: 16 }).notNull(),
  roles: json('roles').$type<string[]>(),
  source: varchar('source', { length: 8 }).$type<'auto' | 'admin'>().notNull(),
  /** auto: mentions carrying the winning role / all titled mentions. */
  hits: int('hits').notNull().default(0),
  total: int('total').notNull().default(0),
  note: varchar('note', { length: 255 }),
  email: varchar('email', { length: 255 }),
  updatedAt: datetime('updated_at').notNull(),
});

export const writingPeopleLog = mysqlTable(
  'writing_people_log',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 40 }).notNull(),
    /** null: no admin correction before / the correction was cleared. */
    before: varchar('before', { length: 16 }),
    after: varchar('after', { length: 16 }),
    beforeRoles: json('before_roles').$type<string[]>(),
    afterRoles: json('after_roles').$type<string[]>(),
    note: varchar('note', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('writing_people_log_name').on(t.name, t.at)],
);

// Tag groups (docs/tag-groups.md): the legacy site's 28 identity groups
// (政治人物、現任立委、藝人…) and its topic catalogue (政治、體育…). A tag
// belongs to any number of groups. Ids 1–28 are the legacy tag_group ids,
// 101–110 the legacy catalogue ids + 100.
export type TagGroupKind = 'group' | 'topic';

export const tagGroupDefs = mysqlTable('tag_group_defs', {
  id: int('id').autoincrement().primaryKey(),
  label: varchar('label', { length: 32 }).notNull(),
  kind: varchar('kind', { length: 8 }).$type<TagGroupKind>().notNull(),
  /** Optional projection into the stable /writing statistics categories. */
  writingRole: varchar('writing_role', { length: 16 }),
  sort: int('sort').notNull().default(0),
  // A group inside another of the same kind (現任立委 in 政治人物): the
  // parent's pages count the child's tags too.
  parentId: int('parent_id'),
  createdAt: datetime('created_at').notNull(),
  // Deleted by an admin. The row stays so the legacy seed does not bring
  // the group back and the rules stop filing into it.
  deletedAt: datetime('deleted_at'),
});

export const tagGroupDefLog = mysqlTable(
  'tag_group_def_log',
  {
    id: int('id').autoincrement().primaryKey(),
    groupId: int('group_id').notNull(),
    action: varchar('action', { length: 8 }).$type<'create' | 'rename' | 'move' | 'sort' | 'delete'>().notNull(),
    // What changed, e.g. 「北市府 → 臺北市府」「上層：政治人物」.
    detail: varchar('detail', { length: 120 }),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('tag_group_def_log_group').on(t.groupId, t.at)],
);

// legacy: copied from the legacy site; admin: added by hand; person: rules
// on tag_people facts; wikidata: the tag's Wikidata type; section: the
// sections of the outlets that use the tag; ai: suggested by the AI gateway,
// always held for review.
export type TagGroupSource = 'legacy' | 'admin' | 'person' | 'wikidata' | 'section' | 'ai';
// auto and confirmed are shown; review waits for an admin; rejected stays
// out, and automatic runs never bring it back.
export type TagGroupStatus = 'auto' | 'review' | 'confirmed' | 'rejected';

export const tagGroupMembers = mysqlTable(
  'tag_group_members',
  {
    tag: varchar('tag', { length: 60 }).notNull(),
    groupId: int('group_id').notNull(),
    source: varchar('source', { length: 10 }).$type<TagGroupSource>().notNull(),
    status: varchar('status', { length: 10 }).$type<TagGroupStatus>().notNull(),
    // Rule strength, 0–1 (share of outlet votes for section); null for hand-made rows.
    score: double('score'),
    // Why, e.g. 「現任立法委員」「上市公司」「12 家媒體 64%」.
    note: varchar('note', { length: 120 }),
    updatedAt: datetime('updated_at').notNull(),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    reviewedAt: datetime('reviewed_at'),
  },
  (t) => [primaryKey({ columns: [t.tag, t.groupId] }), index('tag_group_members_group').on(t.groupId, t.status)],
);

export const tagGroupMemberLog = mysqlTable(
  'tag_group_member_log',
  {
    id: int('id').autoincrement().primaryKey(),
    tag: varchar('tag', { length: 60 }).notNull(),
    groupId: int('group_id').notNull(),
    action: varchar('action', { length: 8 }).$type<'confirm' | 'reject' | 'revoke'>().notNull(),
    fromStatus: varchar('from_status', { length: 10 }),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('tag_group_member_log_tag').on(t.tag, t.at)],
);

// What Wikidata says a non-person tag is (instance of, P31), so the
// wikidata rule does not ask again for 30 days. Null wikidata_id: no item
// whose label or alias is exactly the tag. ai_checked_at: when the AI step
// last suggested groups for the tag (same 30 days).
export const tagWikidata = mysqlTable('tag_wikidata', {
  tag: varchar('tag', { length: 60 }).primaryKey(),
  wikidataId: varchar('wikidata_id', { length: 16 }),
  label: varchar('label', { length: 120 }),
  description: varchar('description', { length: 255 }),
  types: json('types').$type<{ id: string; label: string }[]>(),
  checkedAt: datetime('checked_at'),
  aiCheckedAt: datetime('ai_checked_at'),
});

// A picture for a non-person tag (docs/tag-visuals.md; people get sketch
// avatars instead). kind: place = outline of a county, township, country or
// a city's dot; flag = a country's flag (Wikidata P41), recoloured like a logo; logo = the item's Wikidata logo, recoloured to the site's
// orange; emoji = an emoji that is exactly the thing (line icons were tried
// and dropped). status: auto = shown (places, Commons logos); review = an AI pick,
// not shown until an admin confirms; chosen = an admin confirmed or set it;
// hidden = an admin turned it off; none = nothing fits; voted = readers
// uploaded or voted and the candidate with the most votes is shown
// (docs/tag-pictures.md). Re-runs never overwrite chosen, hidden or voted.
export type TagVisualKind = 'place' | 'flag' | 'logo' | 'emoji';
export type TagVisualStatus = 'auto' | 'review' | 'chosen' | 'hidden' | 'none' | 'voted';

export const tagVisuals = mysqlTable(
  'tag_visuals',
  {
    tag: varchar('tag', { length: 60 }).primaryKey(),
    kind: varchar('kind', { length: 8 }).$type<TagVisualKind>(),
    status: varchar('status', { length: 8 }).$type<TagVisualStatus>().notNull(),
    // emoji: the emoji; logo: the Commons file; place: e.g. tw-county:63000, country:392, city:Q649.
    value: varchar('value', { length: 64 }),
    wikidataId: varchar('wikidata_id', { length: 16 }),
    // What it shows, e.g. 「臺北市」「中國國民黨」.
    label: varchar('label', { length: 120 }),
    // Why, e.g. the AI's reason, 「管理員上傳」.
    note: varchar('note', { length: 120 }),
    // Small picture (tag chips): place outline SVG, recoloured logo WebP.
    image: imageBytes('image'),
    // Larger picture for the tag page: where the place is (Taiwan, the county, the globe).
    large: imageBytes('large'),
    // The logo's Commons file page and terms; places credit their map data in the docs.
    pageUrl: varchar('page_url', { length: 512 }),
    license: varchar('license', { length: 64 }),
    licenseUrl: varchar('license_url', { length: 255 }),
    artist: varchar('artist', { length: 255 }),
    // tag_visual_candidates.rank this row copies; null for an admin's own emoji or upload.
    shownRank: int('shown_rank'),
    checkedAt: datetime('checked_at').notNull(),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    reviewedAt: datetime('reviewed_at'),
  },
  (t) => [index('tag_visuals_status').on(t.status, t.checkedAt)],
);

// Every picture the run found for a tag, best first, for /admin/tag-visuals/
// to pick from (like the avatars' three candidates): the Wikidata item's
// place or logo and the AI's exact emoji. tag_visuals
// holds a copy of the one in use.
export const tagVisualCandidates = mysqlTable(
  'tag_visual_candidates',
  {
    tag: varchar('tag', { length: 60 }).notNull(),
    rank: int('rank').notNull(),
    kind: varchar('kind', { length: 8 }).$type<TagVisualKind>().notNull(),
    value: varchar('value', { length: 64 }),
    wikidataId: varchar('wikidata_id', { length: 16 }),
    label: varchar('label', { length: 120 }),
    // Where it came from, e.g. 「Wikidata：中國國民黨」「AI：代表供水中斷」「Wikidata 項目不符」.
    note: varchar('note', { length: 120 }),
    image: imageBytes('image'),
    large: imageBytes('large'),
    pageUrl: varchar('page_url', { length: 512 }),
    license: varchar('license', { length: 64 }),
    licenseUrl: varchar('license_url', { length: 255 }),
    artist: varchar('artist', { length: 255 }),
    // A reader's upload (users.id); null for found pictures and admin uploads.
    uploadedBy: int('uploaded_by'),
    uploadedAt: datetime('uploaded_at'),
  },
  (t) => [primaryKey({ columns: [t.tag, t.rank] })],
);

export const tagVisualLog = mysqlTable(
  'tag_visual_log',
  {
    id: int('id').autoincrement().primaryKey(),
    tag: varchar('tag', { length: 60 }).notNull(),
    // icon: from when admins could set a line icon (dropped).
    action: varchar('action', { length: 8 }).$type<'confirm' | 'pick' | 'hide' | 'emoji' | 'icon' | 'upload'>().notNull(),
    // What it was and became, e.g. 「emoji 🎆 → 🎇」.
    detail: varchar('detail', { length: 120 }),
    email: varchar('email', { length: 255 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('tag_visual_log_tag').on(t.tag, t.at)],
);

// Readers' votes for a tag's picture (docs/tag-pictures.md): one per user per
// tag, for a candidate rank in tag_avatar_candidates (kind avatar, person
// tags) or tag_visual_candidates (kind visual, every other tag). The
// candidate with the most votes is shown unless an admin chose or hid one.
export const tagPictureVotes = mysqlTable(
  'tag_picture_votes',
  {
    tag: varchar('tag', { length: 60 }).notNull(),
    kind: varchar('kind', { length: 8 }).$type<'avatar' | 'visual'>().notNull(),
    userId: int('user_id').notNull(),
    rank: int('rank').notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tag, t.kind, t.userId] }), index('tag_picture_votes_rank').on(t.tag, t.kind, t.rank)],
);

// Similarweb lookups other observe services ask tag to make
// (docs/similarweb-requests.md). tag's media-traffic job is the only thing
// that calls data.similarweb.com; after its own outlets it spends what is
// left of the run's budget on these rows, oldest first. One row per
// requester, domain and kind (traffic or similar_sites); one request fills
// both kinds for a domain. status: pending (waiting or retrying), ok,
// no-data (Similarweb has nothing for it), blocked (refused 401/403/429,
// retried after next_attempt_at).
export type ExternalTrafficKind = 'traffic' | 'similar_sites';
export type ExternalTrafficStatus = 'pending' | 'ok' | 'no-data' | 'blocked';
export type ExternalTrafficResult = {
  /** Monthly visits, oldest first (Similarweb gives the last three). */
  monthly: { month: string; visits: number }[];
  globalRank: number | null;
  countryRank: { code: string; rank: number } | null;
  category: string | null;
  topCountries: { code: string; share: number }[];
  /** Similarweb's TopSimilarityCompetitors domains. */
  similarSites: string[];
};
export const trafficExternalRequests = mysqlTable(
  'traffic_external_requests',
  {
    id: int('id').autoincrement().primaryKey(),
    requester: varchar('requester', { length: 16 }).notNull(),
    domain: varchar('domain', { length: 253 }).notNull(),
    kind: varchar('kind', { length: 16 }).$type<ExternalTrafficKind>().notNull(),
    requestedAt: datetime('requested_at').notNull(),
    status: varchar('status', { length: 8 }).$type<ExternalTrafficStatus>().notNull(),
    attempts: int('attempts').notNull().default(0),
    nextAttemptAt: datetime('next_attempt_at'),
    lastAttemptAt: datetime('last_attempt_at'),
    lastError: varchar('last_error', { length: 255 }),
    fetchedAt: datetime('fetched_at'),
    // The last 401/403/429 for this domain: no external lookup goes out for six hours after any.
    refusedAt: datetime('refused_at'),
    result: json('result').$type<ExternalTrafficResult>(),
  },
  (t) => [
    uniqueIndex('traffic_external_requests_key').on(t.requester, t.domain, t.kind),
    index('traffic_external_requests_due').on(t.status, t.nextAttemptAt),
    index('traffic_external_requests_refused').on(t.refusedAt),
  ],
);

// One row per Similarweb request sent for another service, for the daily cap.
export const trafficExternalSends = mysqlTable(
  'traffic_external_sends',
  {
    id: int('id').autoincrement().primaryKey(),
    domain: varchar('domain', { length: 253 }).notNull(),
    at: datetime('at').notNull(),
  },
  (t) => [index('traffic_external_sends_at').on(t.at)],
);
