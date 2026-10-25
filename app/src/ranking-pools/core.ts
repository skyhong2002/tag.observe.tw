import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { RankingBasis } from '../jobs/ranking-basis.ts';
import { mediaRankingScore } from '../jobs/ranking-compute.ts';
import { qualifyTagMedia } from '../jobs/tag-qualification.ts';
import { isOwnMediaTag } from '../media-tags.ts';
import { isTagNoise } from '../tag-noise.ts';

export const POLICY_VERSION = 'window-ranking-v1';
export const LIMITS = {
  articles: 300_000,
  tags: 250_000,
  associations: 750_000,
  tagBytes: 32 * 1024 ** 2,
  sourceBytes: 128 * 1024 ** 2,
  runtimeMs: 30_000,
};
export type Gate = 'all' | 'early' | 'broad';
export interface WindowQuery {
  category: string;
  since: string;
  until: string;
  gate: Gate;
  order: 'score';
}
export interface SourceRow {
  id: number;
  media: string;
  publishedAt: Date;
  tags: string[];
}
export interface PoolEntry {
  tag: string;
  tagId: string;
  rank: number;
  score: number;
  articleCount: number;
  mediaCount: number;
  media: Record<string, number>;
}
export class PoolUnavailable extends Error {
  reason: string;
  constructor(reason: string, options?: ErrorOptions) {
    super(reason, options);
    this.reason = reason;
  }
}
export const tagId = (tag: string) => createHash('sha256').update(tag).digest('hex');
export const entryLine = (e: PoolEntry) =>
  JSON.stringify({
    tag: e.tag,
    tagId: e.tagId,
    rank: e.rank,
    score: e.score,
    articleCount: e.articleCount,
    mediaCount: e.mediaCount,
    media: Object.fromEntries(Object.entries(e.media).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)))),
  }) + '\n';
export function parseWindowQuery(q: Record<string, unknown>, now = new Date()): WindowQuery {
  if (Object.keys(q).some((k) => !['category', 'since', 'until', 'gate', 'order'].includes(k))) throw Error('unsupported query parameter');
  const iso = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value))
      throw Error('since/until require UTC ISO8601');
    const d = new Date(value);
    if (!Number.isFinite(d.getTime()) || d.toISOString() !== value.replace(/(?<!\.\d{3})Z$/, '.000Z')) throw Error('invalid UTC date');
    return d.toISOString();
  };
  const since = iso(q.since),
    until = iso(q.until),
    duration = Date.parse(until) - Date.parse(since);
  if (duration <= 0 || duration > 7 * 864e5 || Date.parse(until) > now.getTime())
    throw Error('window must be past, positive and at most7days');
  const category = q.category ?? 'news',
    gate = q.gate ?? 'early',
    order = q.order ?? 'score';
  if (typeof category !== 'string' || !['all', 'early', 'broad'].includes(String(gate)) || order !== 'score')
    throw Error('invalid category/gate/order; only score supported');
  return { category, since, until, gate: gate as Gate, order };
}
export async function collectPool(rows: AsyncIterable<SourceRow>, query: WindowQuery, basis: RankingBasis, limits = LIMITS) {
  const started = performance.now(),
    allowed = new Set(basis.media),
    seen = new Set<number>(),
    terms = new Map<string, Map<string, number>>();
  let sourceBytes = 0,
    tagBytes = 0,
    associations = 0,
    firstMs = Infinity,
    lastMs = -Infinity;
  for await (const row of rows) {
    if (performance.now() - started > limits.runtimeMs) throw new PoolUnavailable('compute-deadline');
    const at = row.publishedAt.getTime();
    if (!allowed.has(row.media) || at < Date.parse(query.since) || at >= Date.parse(query.until) || seen.has(row.id)) continue;
    if (!Number.isSafeInteger(row.id) || row.id < 1 || !Array.isArray(row.tags) || row.tags.some((t) => typeof t !== 'string'))
      throw new PoolUnavailable('source-tag-shape-invalid');
    seen.add(row.id);
    if (seen.size > limits.articles) throw new PoolUnavailable('source-row-cap');
    sourceBytes += Buffer.byteLength(JSON.stringify(row.tags));
    if (sourceBytes > limits.sourceBytes) throw new PoolUnavailable('source-byte-cap');
    firstMs = Math.min(firstMs, at);
    lastMs = Math.max(lastMs, at);
    for (const tag of new Set(row.tags)) {
      if (Buffer.byteLength(tag) <= 1 || isTagNoise(tag) || isOwnMediaTag(tag, row.media)) continue;
      let media = terms.get(tag);
      if (!media) {
        tagBytes += Buffer.byteLength(tag);
        if (terms.size >= limits.tags || tagBytes > limits.tagBytes) throw new PoolUnavailable('candidate-cap');
        media = new Map();
        terms.set(tag, media);
      }
      if (!media.has(row.media) && ++associations > limits.associations) throw new PoolUnavailable('association-cap');
      media.set(row.media, (media.get(row.media) ?? 0) + 1);
    }
  }
  const entries: PoolEntry[] = [];
  for (const [tag, counts] of terms) {
    const media = Object.fromEntries([...counts].sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))));
    const gates = qualifyTagMedia(media);
    if (query.gate !== 'all' && !gates[query.gate]) continue;
    entries.push({
      tag,
      tagId: tagId(tag),
      rank: 0,
      score: mediaRankingScore(media),
      articleCount: Object.values(media).reduce((a, n) => a + n, 0),
      mediaCount: counts.size,
      media,
    });
  }
  entries.sort((a, b) => b.score - a.score || Buffer.compare(Buffer.from(a.tag), Buffer.from(b.tag)));
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });
  if (performance.now() - started > limits.runtimeMs) throw new PoolUnavailable('compute-deadline');
  return {
    entries,
    sourceArticleCount: seen.size,
    sourceFirstPublishedAt: Number.isFinite(firstMs) ? new Date(firstMs).toISOString() : null,
    sourceLastPublishedAt: Number.isFinite(lastMs) ? new Date(lastMs).toISOString() : null,
    candidateTotal: terms.size,
    elapsedMs: Math.round(performance.now() - started),
  };
}
