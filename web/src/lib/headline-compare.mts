// Pure selection and text comparison. No inferred stance or bias score.
export type HeadlineCamp = 'blue' | 'green' | 'other';
export interface CompareArticle {
  id: number;
  title: string;
  url: string;
  publishedAt: string;
  media: string;
  mediaTitle: string;
  camp: HeadlineCamp;
}
export interface CompareEventInput {
  rank: number;
  major: string[];
  tags: Array<{ tag: string }>;
  news: Array<{ title: string }>;
  relatedEventPk: string | null;
}
export interface CompareCoverage {
  from: string;
  to: string;
  byOutlet: Array<{
    media: string;
    title: string;
    camp: HeadlineCamp;
    articles: Array<{ id: number; title: string; url: string; publishedAt: string }>;
  }>;
}
export interface CompareEvent {
  id: string;
  label: string;
  seedTitle: string;
  focusTags: string[];
  political: boolean;
  from: string;
  to: string;
  articles: CompareArticle[];
  pair: [number, number] | null;
}

const POLITICS = /國民黨|民進黨|民眾黨|藍白合|立法院|立院|立委|行政院|總統|市長|選舉|國台辦|兩岸|追加預算|鞭刑|核電|社會住宅|國防部/;
export function politicsPriority(event: CompareEventInput): number {
  return event.major.some((tag) => POLITICS.test(tag))
    ? 2
    : POLITICS.test([...event.tags.map((t) => t.tag), ...event.news.map((n) => n.title)].join(' '))
      ? 1
      : 0;
}

const normalized = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const bigrams = (text: string) => {
  const chars = [...normalized(text)];
  return new Set(chars.slice(1).map((c, i) => chars[i] + c));
};
export function headlineSimilarity(a: string, b: string): number {
  const x = bigrams(a),
    y = bigrams(b);
  if (!x.size || !y.size) return 0;
  return (2 * [...x].filter((v) => y.has(v)).length) / (x.size + y.size);
}
const timestamp = (a: CompareArticle) => Date.parse(a.publishedAt);
const hoursApart = (a: CompareArticle, b: CompareArticle) => Math.abs(timestamp(a) - timestamp(b)) / 3600e3;

export function makeComparison(
  event: CompareEventInput,
  coverage: CompareCoverage,
  pairBy: 'camps' | 'outlets' = 'camps',
): CompareEvent | null {
  const seedTitle = event.news.find((n) => n.title.trim())?.title;
  if (!event.relatedEventPk || !seedTitle) return null;
  const focusTags = [...new Set([...event.major, ...event.tags.map((t) => t.tag)])].filter((t) => seedTitle.includes(t)).slice(0, 4);
  // Shared people/topic tags alone cannot establish that two headlines describe
  // the same development. Also require overlap in their surrounding wording.
  const context = (title: string) => bigrams(focusTags.reduce((text, tag) => text.split(tag).join(' '), title));
  const contextOverlap = (a: string, b: string) => {
    const right = context(b);
    return [...context(a)].filter((part) => right.has(part)).length;
  };
  const seen = new Set<string>();
  const candidates = coverage.byOutlet
    .flatMap((o) => o.articles.map((a) => ({ ...a, media: o.media, mediaTitle: o.title, camp: o.camp })))
    .filter((a) => {
      if (!/^https?:\/\//.test(a.url) || !Number.isFinite(timestamp(a))) return false;
      // The existing coverage endpoint matches ANY lifetime thread tag. Narrow
      // that broad pool against the current event's actual lead headline.
      const hits = focusTags.filter((t) => a.title.includes(t)).length;
      const similarity = headlineSimilarity(a.title, seedTitle);
      if (similarity < 0.18 || (focusTags.length && hits === 0) || contextOverlap(a.title, seedTitle) < 2) return false;
      const key = `${a.media}:${normalized(a.title)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  let pair: [CompareArticle, CompareArticle] | null = null;
  let best = -1;
  for (const left of candidates.filter((a) => pairBy === 'outlets' || a.camp === 'blue')) {
    for (const right of candidates.filter((a) => pairBy === 'outlets' || a.camp === 'green')) {
      if (left.media === right.media || hoursApart(left, right) > 12) continue;
      if (
        pairBy === 'outlets' &&
        (normalized(left.title).includes(normalized(right.title)) || normalized(right.title).includes(normalized(left.title)))
      )
        continue;
      const overlap = headlineSimilarity(left.title, right.title);
      if (overlap < 0.24 || contextOverlap(left.title, right.title) < 2) continue;
      // Prefer topical proximity to the seed, not politically divergent wording.
      const score = overlap + headlineSimilarity(left.title, seedTitle) + headlineSimilarity(right.title, seedTitle);
      if (score > best || (score === best && timestamp(left) > timestamp(pair![0]))) {
        best = score;
        pair = [left, right];
      }
    }
  }
  const anchor = pair?.[0] ?? candidates.sort((a, b) => headlineSimilarity(b.title, seedTitle) - headlineSimilarity(a.title, seedTitle))[0];
  if (!anchor) return null;
  const articles = candidates
    .filter((a) => hoursApart(a, anchor) <= 12 && headlineSimilarity(a.title, anchor.title) >= 0.18)
    .sort((a, b) => timestamp(b) - timestamp(a) || a.id - b.id);
  // Always retain both members of an accepted pair.
  if (pair) for (const a of pair) if (!articles.some((n) => n.id === a.id)) articles.push(a);
  const times = articles.map(timestamp);
  return {
    id: event.relatedEventPk,
    label: (focusTags.length ? focusTags : event.major).join(' · '),
    seedTitle,
    focusTags,
    political: politicsPriority(event) > 0,
    from: new Date(Math.min(...times)).toISOString(),
    to: new Date(Math.max(...times)).toISOString(),
    articles,
    pair: pair ? [pair[0].id, pair[1].id] : null,
  };
}

export interface TextPart {
  text: string;
  different: boolean;
}
/** Character LCS, coalesced into readable runs; never rewrite a source headline. */
export function headlineDiff(left: string, right: string): [TextPart[], TextPart[]] {
  // Limit work for malformed/unexpected upstream headlines while keeping full text.
  if (left.length > 600 || right.length > 600) return [[{ text: left, different: false }], [{ text: right, different: false }]];
  const a = [...left],
    b = [...right];
  const rows = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
  const sameA = new Set<number>(),
    sameB = new Set<number>();
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      sameA.add(i++);
      sameB.add(j++);
    } else if (rows[i + 1][j] >= rows[i][j + 1]) i++;
    else j++;
  }
  const parts = (chars: string[], same: Set<number>): TextPart[] => {
    const out: TextPart[] = [];
    chars.forEach((text, at) => {
      const different = !same.has(at);
      const last = out.at(-1);
      if (last?.different === different) last.text += text;
      else out.push({ text, different });
    });
    return out.map((p) => ({ ...p, different: p.different && /[\p{L}\p{N}]/u.test(p.text) }));
  };
  return [parts(a, sameA), parts(b, sameB)];
}
