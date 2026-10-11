import type { TagPersonFacts } from '../db/schema.ts';

// Wikidata / Wikimedia Commons lookups for tag avatars (docs/tag-avatars.md).
// Wikimedia asks API clients for a descriptive User-Agent with a contact.
export const UA = 'tag.observe.tw-avatars/1.0 (https://tag.observe.tw/; tag avatars from Wikimedia Commons)';

const HUMAN = 'Q5';
// Disambiguation pages, categories, templates, list articles: not a rival meaning.
const WIKIMEDIA = new Set(['Q4167410', 'Q22808320', 'Q15407973', 'Q4167836', 'Q11266439', 'Q13406463']);

type Claim = { mainsnak: { datavalue?: { value: unknown } }; qualifiers?: Record<string, unknown[]> };
type Entity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, unknown>;
};

async function api<T>(host: 'www.wikidata.org' | 'commons.wikimedia.org', params: Record<string, string | number>): Promise<T> {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), format: 'json' })}`;
  // Back off on 429/5xx. (No maxlag: it is meant for bots that edit, and
  // read-only lookups would fail whenever the query service lags.)
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
    const body = res.ok ? ((await res.json()) as T & { error?: { code: string; info: string } }) : null;
    const busy = res.status === 429 || res.status >= 500;
    if (!busy || attempt === 4) {
      if (!body) throw Error(`${host}: HTTP ${res.status}`);
      if (body.error) throw Error(`${host}: ${body.error.info}`);
      return body;
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const LANGS = ['zh-tw', 'zh-hant', 'zh', 'en'];
const pick = (m: Record<string, { value: string }> | undefined) => LANGS.map((l) => m?.[l]?.value).find(Boolean) ?? null;
const ids = (claims: Claim[] | undefined) =>
  (claims ?? []).map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id).filter((v): v is string => !!v);
const strings = (claims: Claim[] | undefined) =>
  (claims ?? []).map((c) => c.mainsnak.datavalue?.value).filter((v): v is string => typeof v === 'string');

async function entities(qids: string[], props: string) {
  const out: Record<string, Entity> = {};
  for (let i = 0; i < qids.length; i += 50) {
    const r = await api<{ entities: Record<string, Entity> }>('www.wikidata.org', {
      action: 'wbgetentities',
      ids: qids.slice(i, i + 50).join('|'),
      props,
      languages: LANGS.join('|'),
    });
    Object.assign(out, r.entities);
  }
  return out;
}

export type Person = {
  qid: string;
  label: string | null;
  description: string | null;
  facts: TagPersonFacts;
  photos: string[];
  categories: string[];
  /** Other humans whose label or alias is exactly this tag. */
  namesakes: number;
  /** The tag is only an alias (nickname, courtesy name…) of this person, not their name. */
  aliasOnly: boolean;
};

/**
 * The human on Wikidata whose label or alias is exactly `tag`. Search hits
 * that only contain the name, or are not people (P31 = Q5), do not count;
 * a non-person with at least as many Wikipedia articles means the tag is
 * about that instead. With namesakes, the one with the most articles wins.
 */
export async function findPerson(tag: string): Promise<Person | null> {
  const search = await api<{ search: { id: string; match: { type: string; text: string } }[] }>('www.wikidata.org', {
    action: 'wbsearchentities',
    search: tag,
    language: 'zh-tw',
    uselang: 'zh-tw',
    type: 'item',
    limit: 10,
  });
  const hits = search.search.filter((h) => h.match.text === tag);
  if (!hits.length) return null;
  const top = search.search[0].id;
  const found = await entities([...new Set([top, ...hits.map((h) => h.id)])], 'labels|descriptions|claims|sitelinks');
  const links = (q: Entity) => Object.keys(q.sitelinks ?? {}).length;
  const items = hits.map((h) => found[h.id]).filter(Boolean);
  const isHuman = (q: Entity) => ids(q.claims?.P31).includes(HUMAN);
  const humans = items.filter(isHuman).sort((a, b) => links(b) - links(a));
  if (!humans.length) return null;
  const e = humans[0];
  // 「AI」「高雄」: a singer and an actor share the name, but the concept and
  // the city (「高雄市」, the top search result) are what the news means. A
  // better-known non-person among the exact matches, or as the top result, wins.
  const rival = (q: Entity | undefined) => q && !isHuman(q) && !ids(q.claims?.P31).some((c) => WIKIMEDIA.has(c)) && links(q) >= links(e);
  if ([...items, found[top]].some(rival)) return null;
  const c = e.claims ?? {};
  // Positions without an end time (P582) are current.
  const positions = (c.P39 ?? []).map((cl) => ({
    id: (cl.mainsnak.datavalue?.value as { id?: string } | undefined)?.id,
    current: !cl.qualifiers?.P582,
  }));
  const refs = [...new Set([...ids(c.P27), ...ids(c.P106), ...ids(c.P102), ...positions.map((p) => p.id).filter(Boolean)])] as string[];
  const labels = await entities(refs, 'labels');
  const name = (q: string) => pick(labels[q]?.labels) ?? q;
  const seen = new Set<string>();
  return {
    qid: e.id,
    label: pick(e.labels),
    description: pick(e.descriptions),
    facts: {
      citizenship: ids(c.P27).map(name),
      occupations: ids(c.P106).map(name),
      // Current party only: memberships with an end time (P582) are past.
      parties: ids((c.P102 ?? []).filter((cl) => !cl.qualifiers?.P582)).map(name),
      // Current posts first; one entry per post (P39 repeats a post per term).
      positions: positions
        .filter((p): p is { id: string; current: boolean } => !!p.id)
        .sort((a, b) => Number(b.current) - Number(a.current))
        .filter((p) => !seen.has(p.id) && seen.add(p.id))
        .map((p) => ({ label: name(p.id), current: p.current })),
    },
    photos: strings(c.P18),
    categories: strings(c.P373),
    namesakes: humans.length - 1,
    // 「川普」 is part of 「唐納·川普」, a name; 「天氣」 for 柏木由紀 is a nickname.
    aliasOnly: hits.find((h) => h.id === e.id)?.match.type !== 'label' && !(pick(e.labels) ?? '').includes(tag),
  };
}

const IMAGE = /\.(jpe?g|png|webp)$/i;
const PORTRAIT = /crop|portrait|肖像|headshot|official|大頭/i;

/**
 * Commons files that may show the person: the Wikidata image(s) first, then
 * files tagged "depicts" this item, then the person's Commons category;
 * portrait-like file names before the rest.
 */
export async function candidateFiles(person: Person, limit = 20) {
  const files = [...person.photos];
  const depicts = await api<{ query: { search: { title: string }[] } }>('commons.wikimedia.org', {
    action: 'query',
    list: 'search',
    srsearch: `haswbstatement:P180=${person.qid}`,
    srnamespace: 6,
    srlimit: 30,
  });
  files.push(...depicts.query.search.map((h) => h.title.replace(/^File:/, '')));
  for (const cat of person.categories) {
    const members = await api<{ query: { categorymembers: { title: string }[] } }>('commons.wikimedia.org', {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${cat}`,
      cmtype: 'file',
      cmlimit: 40,
    });
    files.push(...members.query.categorymembers.map((h) => h.title.replace(/^File:/, '')));
  }
  const unique = [...new Set(files.map((f) => f.replace(/_/g, ' ')))].filter((f) => IMAGE.test(f));
  const [first, ...rest] = unique;
  const ordered = first ? [first, ...rest.filter((f) => PORTRAIT.test(f)), ...rest.filter((f) => !PORTRAIT.test(f))] : [];
  return [...new Set(ordered)].slice(0, limit);
}

export type FileInfo = {
  file: string;
  pageUrl: string;
  thumbUrl: string;
  license: string | null;
  licenseUrl: string | null;
  artist: string | null;
};

const text = (html: string | undefined) =>
  html
    ?.replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255) || null;

/** Thumbnail URL (`width` px) plus license and author for each file. */
export async function fileInfo(files: string[], width = 1200): Promise<FileInfo[]> {
  const out: FileInfo[] = [];
  for (let i = 0; i < files.length; i += 50) {
    type Page = {
      title: string;
      imageinfo?: {
        thumburl?: string;
        descriptionurl: string;
        extmetadata?: Record<string, { value: string } | undefined>;
      }[];
    };
    const r = await api<{ query: { pages: Record<string, Page> } }>('commons.wikimedia.org', {
      action: 'query',
      titles: files
        .slice(i, i + 50)
        .map((f) => `File:${f}`)
        .join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: width,
      iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist',
    });
    for (const p of Object.values(r.query.pages)) {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl) continue;
      const m = info.extmetadata ?? {};
      out.push({
        file: p.title.replace(/^File:/, ''),
        pageUrl: info.descriptionurl,
        thumbUrl: info.thumburl,
        license: text(m.LicenseShortName?.value)?.slice(0, 64) ?? null,
        licenseUrl: m.LicenseUrl?.value?.slice(0, 255) ?? null,
        artist: text(m.Artist?.value),
      });
    }
  }
  // Keep the caller's order.
  return files.map((f) => out.find((o) => o.file === f)).filter((o): o is FileInfo => !!o);
}

export async function download(url: string) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw Error(`HTTP ${res.status} ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}
