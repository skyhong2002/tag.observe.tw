import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import catalog from '../../data/media-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags } from '../db/schema.ts';
import { iconUrl } from './icons.ts';

// Headline comparison for one event thread: every article that carries at
// least one of the thread's major tags inside the thread's time window,
// grouped by outlet and by political camp (藍營／綠營／其他 from media-catalog).
// This is the "same event, different headlines" view; the thread's stored
// `news` JSON only keeps 5–6 picks per hour and is not enough for it.

const info = favicons as unknown as Record<string, { icon: string | null; title: string | null }>;
const categories = catalog.categories as Record<string, string[]>;
export type Camp = 'blue' | 'green' | 'other';
export const CAMP_LABELS: Record<Camp, string> = { blue: '藍營傾向', green: '綠營傾向', other: '其他媒體' };
export const campOf = (media: string, cats: Record<string, string[]> = categories): Camp =>
  cats.blue?.includes(media) ? 'blue' : cats.green?.includes(media) ? 'green' : 'other';

export interface CoverageRow {
  id: number;
  media: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: Date;
  tags: string[];
  description?: string | null;
}
export interface CoverageArticle {
  id: number;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  hits: number; // how many of the thread's major tags this article carries
  // The outlet's own summary, so the headline list can show a line of text;
  // null when missing or only repeating the title.
  description: string | null;
}
export interface OutletCoverage {
  media: string;
  title: string;
  icon: string | null;
  camp: Camp;
  articles: CoverageArticle[];
}
export interface CampCoverage {
  camp: Camp;
  label: string;
  outlets: number;
  articles: number;
}
export interface Coverage {
  majorTags: string[];
  from: string;
  to: string;
  articles: number;
  outlets: number;
  camps: CampCoverage[];
  // Camp(s) that have not reported the event at all while the opposite camp
  // has, i.e. a Ground.news-style blindspot. Empty when both or neither cover it.
  blindspot: Camp[];
  byOutlet: OutletCoverage[];
}

/** Pure grouping so it can be unit-tested without a DB. */
export function groupCoverage(
  rows: CoverageRow[],
  majorTags: string[],
  window: { from: Date; to: Date },
  cats: Record<string, string[]> = categories,
): Coverage {
  // One row per article; an outlet that publishes the same headline under two
  // URLs (AMP/mobile duplicates) is shown once.
  const seenId = new Set<number>();
  const seenTitle = new Set<string>();
  const outlets = new Map<string, OutletCoverage>();
  for (const r of rows) {
    if (!r.title || seenId.has(r.id)) continue;
    seenId.add(r.id);
    const hits = majorTags.filter((t) => r.tags.includes(t)).length;
    if (hits === 0) continue;
    const titleKey = `${r.media}\n${r.title.replace(/\s+/g, '')}`;
    if (seenTitle.has(titleKey)) continue;
    seenTitle.add(titleKey);
    let o = outlets.get(r.media);
    if (!o) {
      o = {
        media: r.media,
        title: info[r.media]?.title ?? r.media,
        icon: iconUrl(r.media),
        camp: campOf(r.media, cats),
        articles: [],
      };
      outlets.set(r.media, o);
    }
    o.articles.push({
      id: r.id,
      title: r.title,
      url: r.url,
      image: r.image,
      publishedAt: r.publishedAt.toISOString(),
      hits,
      description: coverageDescription(r.description, r.title),
    });
  }
  const camps: Record<Camp, CampCoverage> = {
    blue: { camp: 'blue', label: CAMP_LABELS.blue, outlets: 0, articles: 0 },
    green: { camp: 'green', label: CAMP_LABELS.green, outlets: 0, articles: 0 },
    other: { camp: 'other', label: CAMP_LABELS.other, outlets: 0, articles: 0 },
  };
  let total = 0;
  for (const o of outlets.values()) {
    o.articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    camps[o.camp].outlets += 1;
    camps[o.camp].articles += o.articles.length;
    total += o.articles.length;
  }
  const byOutlet = [...outlets.values()].sort(
    (a, b) => b.articles.length - a.articles.length || a.articles[0].publishedAt.localeCompare(b.articles[0].publishedAt),
  );
  const blindspot: Camp[] = [];
  if (camps.blue.articles > 0 && camps.green.articles === 0) blindspot.push('green');
  if (camps.green.articles > 0 && camps.blue.articles === 0) blindspot.push('blue');
  return {
    majorTags,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    articles: total,
    outlets: outlets.size,
    camps: [camps.blue, camps.green, camps.other],
    blindspot,
    byOutlet,
  };
}

const HOUR = 3600e3;
// Enough for two or three lines under a headline; 400 rows stay small.
const DESCRIPTION_MAX = 160;

/** The outlet's summary as a short lede, or null when it adds nothing to the title. */
export function coverageDescription(description: string | null | undefined, title: string): string | null {
  const text = description?.replace(/\s+/g, ' ').trim();
  if (!text || text.length < 12) return null;
  const bare = (s: string) => s.replace(/[\s\p{P}]/gu, '');
  if (bare(title).includes(bare(text)) || bare(text) === bare(title)) return null;
  const chars = [...text];
  return chars.length > DESCRIPTION_MAX
    ? `${chars
        .slice(0, DESCRIPTION_MAX - 1)
        .join('')
        .trimEnd()}…`
    : text;
}
export async function loadThreadCoverage(
  db: Db,
  thread: { majorTags: string[]; firstTime: Date; lastTime: Date },
  limit = 400,
): Promise<Coverage> {
  // Events are clustered over the previous 24h of articles, so reports that
  // seeded the first hour can be older than first_time; look back a little.
  const window = { from: new Date(thread.firstTime.getTime() - 6 * HOUR), to: new Date(thread.lastTime.getTime() + HOUR) };
  // Threads accumulate major tags over their lifetime (typically 3–6).
  const majorTags = [...new Set(thread.majorTags.filter((t) => t.trim()))].slice(0, 8);
  if (majorTags.length === 0) return groupCoverage([], majorTags, window);
  const rows = await db
    .selectDistinct({
      id: articles.id,
      media: articles.media,
      title: articles.title,
      url: articles.url,
      image: articles.image,
      publishedAt: articles.publishedAt,
      tags: articles.tags,
      description: articles.description,
    })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(and(inArray(articleTags.tag, majorTags), gte(articleTags.publishedAt, window.from), lte(articleTags.publishedAt, window.to)))
    .limit(limit);
  return groupCoverage(rows, majorTags, window);
}
