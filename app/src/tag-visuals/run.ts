import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { type Claim, download, entities, fileInfo, findItem, looseItems } from '../avatars/wikidata.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTags, type TagVisualStatus, tagPeople, tagVisualCandidates, tagVisuals, tagWikidata } from '../db/schema.ts';
import type { AiConfig } from '../tag-groups/ai.ts';
import { type Pick, pickVisuals, type VisualItem } from './ai.ts';
import { city, country, type Place, taiwanPlace } from './places.ts';
import { recolourLogo } from './recolour.ts';

// Pictures for non-person tags (docs/tag-visuals.md), in this order: a
// Taiwan county or township by name; the tag's Wikidata item as a country,
// a city (a dot) or an organisation or work with a logo, shown once the AI
// agrees it is what the news means; otherwise the AI's exact emoji, held for
// review, or nothing (line icons were tried and dropped). Every picture found is kept as a
// candidate for /admin/tag-visuals/; tag_visuals copies the one in use.
// Person tags are left to the sketch avatars.

const RECHECK_DAYS = 30;
const HUMAN = 'Q5';
const TAIWAN = 'Q865';

type Log = (obj: object) => void;
export type Candidate = Omit<typeof tagVisualCandidates.$inferInsert, 'tag' | 'rank'>;
const NONE = {
  kind: null,
  value: null,
  wikidataId: null,
  label: null,
  note: null,
  image: null,
  large: null,
  pageUrl: null,
  license: null,
  licenseUrl: null,
  artist: null,
};

/** The preferred statement, else the first one still current (no end time, P582): Moscow's P17 lists the Grand Duchy first. */
const value = <T>(claims: Claim[] | undefined) => {
  const live = (claims ?? []).filter((c) => c.rank !== 'deprecated');
  const pick = live.find((c) => c.rank === 'preferred') ?? live.find((c) => !c.qualifiers?.P582) ?? live[0];
  return pick?.mainsnak.datavalue?.value as T | undefined;
};

/** Replaces the tag's candidates; the first one is put in use (shown when `status` is auto, waiting when review). */
async function save(db: Db, tag: string, status: TagVisualStatus, candidates: Candidate[], note: string | null = null) {
  const [first] = candidates;
  const values = {
    ...NONE,
    ...(first ?? {}),
    note: (first?.note ?? note)?.slice(0, 120) ?? null,
    status: first ? status : ('none' as const),
    shownRank: first ? 1 : null,
    checkedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
  };
  await db.transaction(async (tx) => {
    await tx.delete(tagVisualCandidates).where(eq(tagVisualCandidates.tag, tag));
    if (candidates.length) await tx.insert(tagVisualCandidates).values(candidates.map((c, i) => ({ ...NONE, ...c, tag, rank: i + 1 })));
    await tx
      .insert(tagVisuals)
      .values({ tag, ...values })
      .onDuplicateKeyUpdate({ set: values });
  });
  return { tag, status: values.status, kind: first?.kind ?? null, value: first?.value ?? null, candidates: candidates.length };
}

const placeCandidate = (p: Place, wikidataId: string | null = null): Candidate => ({
  kind: 'place',
  value: p.value,
  label: p.label.slice(0, 120),
  wikidataId,
  note: wikidataId ? `Wikidata：${p.label}`.slice(0, 120) : '台灣縣市鄉鎮',
  image: Buffer.from(p.image),
  large: Buffer.from(p.large),
});

/**
 * A place or a logo from the tag's Wikidata item (tag_wikidata, filled by
 * the tag-groups job), or null when the item is neither.
 */
async function fromItem(qid: string): Promise<Candidate | null> {
  const found = await entities([qid], 'labels|claims');
  const e = found[qid];
  if (!e?.claims) return null;
  const c = e.claims;
  const label = ['zh-tw', 'zh-hant', 'zh', 'en'].map((l) => e.labels?.[l]?.value).find(Boolean) ?? qid;
  const iso = value<string>(c.P299);
  if (iso) {
    const p = country(iso, label);
    if (p) return placeCandidate(p, qid);
  }
  const at = value<{ latitude: number; longitude: number }>(c.P625);
  const home = value<{ id: string }>(c.P17)?.id;
  // A settlement or an area people live in: coordinates and a population.
  if (at && c.P1082?.length && home) {
    const homeIso = home === TAIWAN ? '158' : (value<string>((await entities([home], 'claims'))[home]?.claims?.P299) ?? null);
    return placeCandidate(city(qid, label, [at.longitude, at.latitude], homeIso), qid);
  }
  const logo = value<string>(c.P154);
  if (logo) {
    const [info] = await fileInfo([logo], 512);
    if (info) {
      return {
        kind: 'logo',
        value: info.file.slice(0, 64),
        label: label.slice(0, 120),
        wikidataId: qid,
        note: `Wikidata：${label}`.slice(0, 120),
        image: await recolourLogo(await download(info.thumbUrl)),
        pageUrl: info.pageUrl.slice(0, 512),
        license: info.license,
        licenseUrl: info.licenseUrl,
        artist: info.artist,
      };
    }
  }
  return null;
}

/**
 * The candidates in order, and whether the first may show without review:
 * the Wikidata item's picture first when the AI agrees it is what the news
 * means; else the AI's exact emoji, and last the item's picture marked as not
 * matching (an admin may still know better).
 */
export function arrange(pick: Pick | undefined, model: string, item: Candidate | null) {
  const ai = `AI（${model}）`;
  const why = pick?.why ? `${pick.why}・${ai}` : ai;
  const picks: Candidate[] = pick?.emoji ? [{ kind: 'emoji', value: pick.emoji, note: why }] : [];
  if (item && pick?.same === true) return { status: 'auto' as const, candidates: [item, ...picks] };
  const doubtful = item ? [{ ...item, note: `Wikidata 項目不符・${item.note ?? ''}`.slice(0, 120) }] : [];
  return { status: 'review' as const, candidates: [...picks, ...doubtful], note: why };
}

export async function processTags(
  db: Db,
  tags: string[],
  {
    force = false,
    ai = null as AiConfig | null,
    batch = 20,
    fetchImpl = fetch as typeof fetch,
    // Tests stand in for Wikidata here.
    itemImpl = fromItem,
    findImpl = findItem,
    looseImpl = looseItems,
    log = (() => {}) as Log,
    stop = (): boolean => false,
  } = {},
) {
  const tally: Record<string, number> = {};
  const count = (k: string) => {
    tally[k] = (tally[k] ?? 0) + 1;
  };
  if (!tags.length) return tally;
  const [prior, people, items] = await Promise.all([
    db
      .select({ tag: tagVisuals.tag, status: tagVisuals.status, checkedAt: tagVisuals.checkedAt })
      .from(tagVisuals)
      .where(inArray(tagVisuals.tag, tags)),
    db
      .select({ tag: tagPeople.tag })
      .from(tagPeople)
      .where(and(inArray(tagPeople.tag, tags), isNotNull(tagPeople.wikidataId))),
    db.select().from(tagWikidata).where(inArray(tagWikidata.tag, tags)),
  ]);
  const before = new Map(prior.map((p) => [p.tag, p]));
  const persons = new Set(people.map((p) => p.tag));
  const item = new Map(items.map((i) => [i.tag, i]));
  const fresh = Date.now() - RECHECK_DAYS * 86_400_000;
  const forAi: { tag: string; row: Awaited<ReturnType<typeof fromItem>>; candidate?: string }[] = [];
  for (const tag of tags) {
    if (stop()) break;
    const old = before.get(tag);
    // An admin's choice and readers' votes (docs/tag-pictures.md) outlive re-runs.
    if (!force && old && (['chosen', 'hidden', 'voted'].includes(old.status) || old.checkedAt.getTime() >= fresh)) continue;
    try {
      // Tags the tag-groups job has not looked up yet (the home cloud's newest): look up and keep, as it would.
      let wd = item.get(tag);
      if (!wd) {
        const found = await findImpl(tag);
        const values = {
          wikidataId: found?.qid ?? null,
          label: found?.label?.slice(0, 120) ?? null,
          description: found?.description?.slice(0, 255) ?? null,
          types: found?.types ?? null,
          checkedAt: new Date(),
        };
        await db
          .insert(tagWikidata)
          .values({ tag, ...values })
          .onDuplicateKeyUpdate({ set: values });
        wd = { tag, ...values, aiCheckedAt: null };
      }
      // A county name beats a namesake: 「高雄」 is also a Hong Kong actor on Wikidata.
      const place = taiwanPlace(tag);
      // Other people get sketch avatars (docs/tag-avatars.md).
      if (!place && (persons.has(tag) || wd?.types?.some((t) => t.id === HUMAN))) continue;
      if (place) {
        const r = await save(db, tag, 'auto', [placeCandidate(place)]);
        count(`${r.kind}`);
        log(r);
        continue;
      }
      // An item's place or logo waits for the AI to agree it is what the news means.
      let row = wd?.wikidataId ? await itemImpl(wd.wikidataId) : null;
      let candidate = row ? `${wd?.label ?? row.label}${wd?.description ? `（${wd.description}）` : ''}` : undefined;
      // No item is exactly the tag: Wikidata names 鴻海 「鴻海精密工業」. Try the
      // items whose name contains it; the AI's same-check guards these too.
      if (!wd?.wikidataId)
        for (const loose of await looseImpl(tag)) {
          row = await itemImpl(loose.qid);
          if (!row) continue;
          row = { ...row, note: `名稱相近・${row.note ?? ''}`.slice(0, 120) };
          candidate = `${loose.label ?? loose.qid}${loose.description ? `（${loose.description}）` : ''}`;
          break;
        }
      forAi.push(row ? { tag, row, candidate } : { tag, row: null });
    } catch (err) {
      count('error');
      log({ tag, error: String(err) });
    }
  }
  // Without the gateway these tags stay unchecked, so a later run asks.
  if (!ai) {
    if (forAi.length) tally.unasked = forAi.length;
    return tally;
  }
  const since = new Date(Date.now() - 30 * 86_400_000);
  for (let i = 0; i < forAi.length; i += batch) {
    if (stop()) break;
    const chunk = forAi.slice(i, i + batch);
    const asking: VisualItem[] = [];
    for (const { tag, candidate } of chunk) {
      const rows = await db
        .select({ title: articles.title })
        .from(articleTags)
        .innerJoin(articles, eq(articles.id, articleTags.articleId))
        .where(and(eq(articleTags.tag, tag), gte(articleTags.publishedAt, since)))
        .orderBy(desc(articleTags.publishedAt))
        .limit(8);
      asking.push({ tag, candidate, titles: [...new Set(rows.map((r) => r.title.trim()))].slice(0, 4) });
    }
    let reply: Awaited<ReturnType<typeof pickVisuals>>;
    try {
      reply = await pickVisuals(ai, asking, fetchImpl);
    } catch (err) {
      count('error');
      log({ tags: chunk.map((c) => c.tag), error: String(err) });
      continue;
    }
    for (const { tag, row } of chunk) {
      const pick = reply.picks.get(tag);
      const { status, candidates, note } = arrange(pick, reply.model, row);
      const r = await save(db, tag, status, candidates, note);
      count(r.status === 'none' ? 'none' : `${r.kind}`);
      log(r);
    }
  }
  return tally;
}
