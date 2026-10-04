import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { loadTitleVocab, type TitleVocab, tagsFromTitle } from '../crawl/title-tags.ts';
import { byUpdate } from '../crawl/topic-kind.ts';
import { sharedTag } from '../crawl/topic-page.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTags, topics } from '../db/schema.ts';
import { articleMediaOf } from './topics-job.ts';

// Links a topic (an outlet's 專題 page) to the coverage we crawled: the site
// tags found in the topic name, and recent articles from every outlet that
// carry all of them.

export interface TopicCoverage {
  tags: string[];
  // 'title': tags found in the topic name; 'page': the tag the outlet's own
  // stories on the topic page share (for names like 無人知曉的死亡).
  basis: 'title' | 'page';
  count: number;
  capped: boolean;
  mediaCount: number;
  latest: Array<{ id: number; media: string; title: string; url: string; time: string }>;
}

const WINDOW_DAYS = 3;
const CAP = 500;

// Tags must stand for the topic name (digits/punctuation aside): covering
// more than half of it, or at least 40% when the tags are specific (used by
// few articles this week). "失智" alone does not stand for 馬駁失智傳聞, nor the
// ubiquitous 亞運 for 亞運捷報; 核電重啟, 台師大+抽血案, or the rarely used 黎智英
// for 港府逮捕黎智英 do.
const SPECIFIC = 30; // 7-day article count; about the vocabulary's 90th percentile
const core = (s: string) => [...s.replace(/[\d\s\p{P}\p{S}]/gu, '')].length;
function standsFor(title: string, tags: string[], vocab: TitleVocab): boolean {
  const n = core(title);
  if (!n || !tags.length) return false;
  const share = tags.reduce((sum, t) => sum + core(t), 0) / n;
  return share > 0.5 || (share >= 0.4 && tags.every((t) => (vocab.freq.get(t) ?? Infinity) <= SPECIFIC));
}

/** Tag sets to try for a topic, best first: all its tags, then (when no
 *  article carries every one, e.g. 黃子佼+道歉) each tag that alone still
 *  stands for the name, most specific first. */
export function topicTagSets(title: string, vocab: TitleVocab): string[][] {
  const tags = tagsFromTitle(title, vocab, 3);
  const sets = standsFor(title, tags, vocab) ? [tags] : [];
  if (tags.length > 1)
    for (const t of [...tags].sort((a, b) => (vocab.freq.get(a) ?? 0) - (vocab.freq.get(b) ?? 0)))
      if (standsFor(title, [t], vocab)) sets.push([t]);
  return sets;
}
export const topicTags = (title: string, vocab: TitleVocab): string[] => topicTagSets(title, vocab)[0] ?? [];

// Words about the package or its framing rather than its subject (CNA's
// 懶人包, 入圍焦點; the 風暴 of 關稅風暴), useless as a shared keyword. Kinds of
// event (離婚, 修法…) too: they gather unrelated stories (three divorces,
// seventeen bills), not one story several outlets packaged.
const PACKAGE_WORDS = new Set([
  '離婚',
  '戰爭',
  '修法',
  '大火',
  '專題',
  '專輯',
  '策展',
  '特輯',
  '懶人包',
  '論壇',
  '趨勢',
  '爭議',
  '名人',
  '評論',
  '入圍',
  '最新情勢',
  '影音',
  '直播',
  '報導',
  '風暴',
]);

/** Keywords a topic name is about, from its title alone (no article lookup):
 *  every tag of the sets in topicTagSets, package words left out. Stable
 *  whether or not anything was published on it lately. */
export function topicTitleTags(title: string, vocab: TitleVocab): string[] {
  return [...new Set(topicTagSets(title, vocab).flat())].filter((t) => !PACKAGE_WORDS.has(t));
}

export interface TopicTagCount {
  tag: string;
  /** Outlets with a 議題 or 專題 carrying the tag. */
  media: number;
  topic: number;
  feature: number;
}
/** The most common keywords across 議題 and 專題: by outlets, then by items.
 *  A tag on one item only says nothing about what outlets package. */
export function topicTagSummary(items: Array<{ media: string; kind: string; tags: string[] }>, limit = 40): TopicTagCount[] {
  const by = new Map<string, { media: Set<string>; topic: number; feature: number }>();
  for (const it of items)
    for (const tag of it.tags) {
      const c = by.get(tag) ?? { media: new Set<string>(), topic: 0, feature: 0 };
      c.media.add(it.media);
      if (it.kind === 'feature') c.feature++;
      else c.topic++;
      by.set(tag, c);
    }
  return [...by]
    .map(([tag, c]) => ({ tag, media: c.media.size, topic: c.topic, feature: c.feature }))
    .filter((c) => c.topic + c.feature >= 2)
    .sort((a, b) => b.media - a.media || b.topic + b.feature - (a.topic + a.feature) || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Items carrying `tag` (exact) whose title contains `q` (case-insensitive);
 *  either may be omitted. Grouped by outlet, outlets with most matches first
 *  (then `mediaOrder`), most recently updated first within an outlet (byUpdate). */
export function matchTopics<T extends { id: string; media: string; title: string; tags: string[]; time: string; updatedAt: string | null }>(
  items: T[],
  { tag, q }: { tag?: string; q?: string },
  mediaOrder: string[] = [],
): T[] {
  const needle = q?.trim().toLowerCase();
  const hits = items.filter((it) => (!tag || it.tags.includes(tag)) && (!needle || it.title.toLowerCase().includes(needle)));
  const perMedia = new Map<string, number>();
  for (const h of hits) perMedia.set(h.media, (perMedia.get(h.media) ?? 0) + 1);
  const order = (m: string) => {
    const i = mediaOrder.indexOf(m);
    return i < 0 ? mediaOrder.length : i;
  };
  return hits.sort(
    (a, b) =>
      (perMedia.get(b.media) ?? 0) - (perMedia.get(a.media) ?? 0) ||
      order(a.media) - order(b.media) ||
      a.media.localeCompare(b.media) ||
      byUpdate(a, b),
  );
}

let cached: { vocab: TitleVocab; at: number } | null = null;
async function vocab(db: Db) {
  if (!cached || Date.now() - cached.at > 3600e3) cached = { vocab: await loadTitleVocab(db, { days: 7 }), at: Date.now() };
  return cached.vocab;
}

/** topicTitleTags against the current vocabulary, memoised per title until the
 *  vocabulary is reloaded (hourly): tagging all ~4,500 topics costs ~80 ms once. */
let memo: { vocab: TitleVocab; tags: Map<string, string[]> } | null = null;
export async function topicTagger(db: Db): Promise<(title: string) => string[]> {
  const v = await vocab(db);
  if (memo?.vocab !== v) memo = { vocab: v, tags: new Map() };
  const tags = memo.tags;
  return (title) => {
    let t = tags.get(title);
    if (!t) tags.set(title, (t = topicTitleTags(title, v)));
    return t;
  };
}

export async function topicCoverage(
  db: Db,
  items: Array<string | { title: string; id?: string | number }>,
  now = new Date(),
): Promise<Map<string, TopicCoverage>> {
  const v = await vocab(db);
  const since = new Date(+now - WINDOW_DAYS * 86400e3);
  const out = new Map<string, TopicCoverage>();
  const recent = (set: string[]) =>
    db
      .select({ id: articles.id, media: articles.media, title: articles.title, url: articles.url, at: articles.publishedAt })
      .from(articleTags)
      .innerJoin(articles, eq(articles.id, articleTags.articleId))
      .where(and(inArray(articleTags.tag, set), gte(articleTags.publishedAt, since), lte(articleTags.publishedAt, now)))
      .groupBy(articles.id)
      .having(sql`COUNT(DISTINCT ${articleTags.tag}) = ${set.length}`)
      .orderBy(desc(articles.publishedAt))
      .limit(CAP);
  const list = items.map((i) => (typeof i === 'string' ? { title: i } : i));
  for (const { title, id } of list) {
    if (out.has(title)) continue;
    let tags: string[] = [];
    let basis: TopicCoverage['basis'] = 'title';
    let rows: Awaited<ReturnType<typeof recent>> = [];
    for (const set of topicTagSets(title, v)) {
      tags = set;
      rows = await recent(set);
      if (rows.length) break;
    }
    if (!rows.length && id != null) {
      const tag = await pageTag(db, Number(id), v);
      if (tag) {
        tags = [tag];
        basis = 'page';
        rows = await recent(tags);
      }
    }
    if (!rows.length) continue;
    // Latest headlines, one per outlet.
    const seen = new Set<string>();
    const latest = rows
      .filter((r) => !seen.has(r.media) && seen.add(r.media))
      .slice(0, 3)
      .map((r) => ({ id: r.id, media: r.media, title: r.title, url: r.url, time: r.at.toISOString() }));
    out.set(title, {
      tags,
      basis,
      count: rows.length,
      capped: rows.length === CAP,
      mediaCount: new Set(rows.map((r) => r.media)).size,
      latest,
    });
  }
  return out;
}

/** The tag shared by the outlet's own stories listed on the topic page (refreshTopicPages). */
async function pageTag(db: Db, topicId: number, v: TitleVocab): Promise<string | null> {
  const [topic] = await db.select({ media: topics.media, stories: topics.pageStories }).from(topics).where(eq(topics.id, topicId));
  if (!topic?.stories?.length) return null;
  // Tags of the stories we crawled; headline tags for the rest.
  const crawled = await db
    .select({ key: articles.urlKey, tags: articles.tags })
    .from(articles)
    .where(
      and(
        eq(articles.media, articleMediaOf(topic.media)),
        inArray(
          articles.urlKey,
          topic.stories.map((s) => s.key),
        ),
      ),
    );
  const byKey = new Map(crawled.map((c) => [c.key, c.tags ?? []]));
  return sharedTag(
    topic.stories.map((s) => (byKey.get(s.key)?.length ? (byKey.get(s.key) as string[]) : tagsFromTitle(s.title, v))),
    (t) => v.freq.get(t),
  );
}
