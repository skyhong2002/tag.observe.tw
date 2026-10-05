import { and, eq, gte, sql } from 'drizzle-orm';
import noEqual from '../../data/no-equal-tags.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags } from '../db/schema.ts';
import { isTagNoise } from '../tag-noise.ts';

// Fallback tagging for articles whose page exposes no keywords: match the
// title against tags the other media already use (seen in >= minArticles
// articles recently). Longest match wins; a tag contained in a longer matched
// tag is dropped; Latin tags need word boundaries ("AI" must not match "AIRBUS").
export interface TitleVocab {
  byBigram: Map<string, string[]>;
  freq: Map<string, number>;
  size: number;
}
const LATIN = /^[A-Za-z0-9][A-Za-z0-9 .&+-]*$/;
const GENERIC = new Set((noEqual as { tags: string[] }).tags);

// Two-character CJK tags are often plain words (人生, 交易); only trust them
// when many articles already use them.
const MIN_SHORT = 10;

export function buildVocab(entries: Array<{ tag: string; n: number }>, { minShort = MIN_SHORT } = {}): TitleVocab {
  const byBigram = new Map<string, string[]>();
  const freq = new Map<string, number>();
  for (const { tag, n } of entries) {
    const t = tag.trim();
    const chars = [...t];
    if (chars.length < 2 || chars.length > 15 || GENERIC.has(t) || isTagNoise(t) || /^\d+$/.test(t)) continue;
    if (LATIN.test(t) && t.length < 2) continue;
    if (chars.length === 2 && !LATIN.test(t) && n < minShort) continue;
    freq.set(t, n);
    const key = chars.slice(0, 2).join('').toLowerCase();
    const list = byBigram.get(key) ?? [];
    list.push(t);
    byBigram.set(key, list);
  }
  for (const list of byBigram.values()) list.sort((a, b) => [...b].length - [...a].length);
  return { byBigram, freq, size: freq.size };
}

export function tagsFromTitle(title: string, vocab: TitleVocab, max = 8): string[] {
  const chars = [...title];
  const lower = chars.map((c) => c.toLowerCase());
  const found = new Set<string>();
  // Positions inside 《…》 belong to a work title; only the whole title may match.
  const inWork = new Array<boolean>(chars.length).fill(false);
  const works: string[] = [];
  for (let i = 0, open = -1; i < chars.length; i++) {
    if (chars[i] === '《') open = i;
    else if (chars[i] === '》' && open >= 0) {
      for (let k = open + 1; k < i; k++) inWork[k] = true;
      works.push(chars.slice(open + 1, i).join(''));
      open = -1;
    }
  }
  for (const w of works) if (vocab.freq.has(w)) found.add(w);
  for (let i = 0; i < chars.length - 1; i++) {
    if (inWork[i]) continue;
    const candidates = vocab.byBigram.get(lower[i] + lower[i + 1]);
    if (!candidates) continue;
    for (const tag of candidates) {
      const tc = [...tag.toLowerCase()];
      if (i + tc.length > chars.length || tc.some((c, k) => lower[i + k] !== c)) continue;
      if (LATIN.test(tag)) {
        const before = chars[i - 1],
          after = chars[i + tc.length];
        if ((before && /[A-Za-z0-9]/.test(before)) || (after && /[A-Za-z0-9]/.test(after))) continue;
      }
      found.add(tag);
      break; // longest candidate at this position
    }
  }
  const list = [...found].filter((t) => ![...found].some((o) => o !== t && o.includes(t)));
  return list.sort((a, b) => (vocab.freq.get(b) ?? 0) - (vocab.freq.get(a) ?? 0)).slice(0, max);
}

export async function loadTitleVocab(db: Db, { days = 30, minArticles = 3, minShort = MIN_SHORT } = {}): Promise<TitleVocab> {
  const rows = await db
    .select({ tag: articleTags.tag, n: sql<number>`COUNT(DISTINCT ${articleTags.articleId})` })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(and(eq(articles.source, 'own'), gte(articleTags.publishedAt, new Date(Date.now() - days * 86400e3))))
    .groupBy(articleTags.tag)
    .having(sql`COUNT(DISTINCT ${articleTags.articleId}) >= ${minArticles}`);
  return buildVocab(
    rows.map((r) => ({ tag: r.tag, n: Number(r.n) })),
    { minShort },
  );
}
