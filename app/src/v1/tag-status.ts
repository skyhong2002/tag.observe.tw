import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { eventThreads, tagStats } from '../db/schema.ts';
import type { BurstEntry } from '../jobs/ranking-compute.ts';
import { loadRelatedTags, type RelatedTag } from './tag-related.ts';

const HOUR = 3600e3;

export interface TagRankingStatus {
  category: string;
  hourStart: string;
  position: number;
  rank: number;
  normalized: number;
  burst: number | null;
  count: number;
  mediaCount: number;
  basisMediaCount: number;
  rank24h: number | null;
  new: boolean;
}
export interface TagThread {
  id: number;
  maxTag: string | null;
  majorTags: string[];
  firstTime: Date;
  lastTime: Date;
  hours: number;
  maxScore: number;
}
export interface TagHistory {
  level: number;
  firstHour: Date;
  lastHour: Date;
  hoursCount: number;
  maxHour: Date;
  maxCount: number;
}
export interface TagStatus {
  tag: string;
  ranking: TagRankingStatus | null;
  related: RelatedTag[];
  threads: TagThread[];
  history: TagHistory | null;
}

type RankingResult = {
  snapshot: { category: string; hourStart: Date; computedAt: Date; basis: { media: string[] } };
  entries: Array<BurstEntry & { rank24h: number | null; new: boolean }>;
} | null;

/**
 * Everything the ranking table knows about one tag, plus the event threads
 * and long-term stats behind it, so the tag page is at least as informative
 * as a ranking row. Ranking data is for the news category; `ranking` is
 * null when the tag is not on the current chart.
 */
export async function loadTagStatus(db: Db, tag: string, ranking: RankingResult, now = new Date()): Promise<TagStatus> {
  const index = ranking?.entries.findIndex((e) => e.tag === tag) ?? -1;
  const entry = index >= 0 ? ranking!.entries[index] : null;
  const basisMedia = ranking?.snapshot.basis.media ?? [];
  const windowEnd = ranking ? new Date(ranking.snapshot.computedAt) : now;
  const [related, threads, stats] = await Promise.all([
    basisMedia.length
      ? loadRelatedTags(db, [tag], basisMedia, new Date(windowEnd.getTime() - 24 * HOUR), windowEnd, 8)
      : new Map<string, RelatedTag[]>(),
    db
      .select({
        id: eventThreads.id,
        maxTag: eventThreads.maxTag,
        majorTags: eventThreads.majorTags,
        firstTime: eventThreads.firstTime,
        lastTime: eventThreads.lastTime,
        hours: eventThreads.hours,
        maxScore: eventThreads.maxScore,
      })
      .from(eventThreads)
      .where(
        and(
          eq(eventThreads.category, 'news'),
          gte(eventThreads.lastTime, new Date(now.getTime() - 72 * HOUR)),
          sql`JSON_CONTAINS(${eventThreads.allTags}, JSON_QUOTE(${tag}))`,
        ),
      )
      .orderBy(desc(eventThreads.lastTime), desc(eventThreads.maxScore))
      .limit(6),
    db
      .select()
      .from(tagStats)
      .where(and(eq(tagStats.tag, tag), eq(tagStats.category, 'news'), inArray(tagStats.level, [2, 3])))
      .orderBy(desc(tagStats.level))
      .limit(1),
  ]);
  const history = stats[0];
  return {
    tag,
    ranking:
      entry && ranking
        ? {
            category: ranking.snapshot.category,
            hourStart: ranking.snapshot.hourStart.toISOString(),
            position: index + 1,
            rank: entry.rank,
            normalized: entry.normalized,
            burst: entry.burst,
            count: entry.count,
            mediaCount: Object.keys(entry.media).length,
            basisMediaCount: basisMedia.length,
            rank24h: entry.rank24h,
            new: entry.new,
          }
        : null,
    related: related.get(tag) ?? [],
    threads: threads.map((t) => ({ ...t, maxScore: t.maxScore / 1e6 })),
    history: history
      ? {
          level: history.level,
          firstHour: history.firstHour,
          lastHour: history.lastHour,
          hoursCount: history.hoursCount,
          maxHour: history.maxHour,
          maxCount: history.maxCount,
        }
      : null,
  };
}
