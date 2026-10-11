import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { findItem, findPerson } from '../avatars/wikidata.ts';
import type { Db } from '../db/client.ts';
import {
  articles,
  articleTags,
  type TagGroupSource,
  type TagGroupStatus,
  tagGroupDefs,
  tagGroupMembers,
  tagPeople,
  tagStats,
  tagWikidata,
} from '../db/schema.ts';
import { HUMAN, personGroups, SEED_GROUPS, sectionTopic, typeGroups, voteTopics } from './rules.ts';

// Automatic tag grouping (docs/tag-groups.md). Every rule writes rows with
// its own source; a later run replaces that source's auto rows for the tag
// and never touches review, confirmed or rejected rows, so an admin's
// decision always wins.

const RECHECK_DAYS = 30;

export async function seedGroupDefs(db: Db) {
  const now = new Date();
  await db
    .insert(tagGroupDefs)
    .ignore()
    .values(SEED_GROUPS.map((g, i) => ({ ...g, sort: i, createdAt: now })));
}

export type Row = { groupId: number; score: number | null; note: string | null; status?: TagGroupStatus };

/** Replaces `source`'s automatic rows for `tag` with `rows`. Rows an
 *  admin confirmed or rejected stay as they are. An auto row from another
 *  source is taken over only by a higher score; a row another source left
 *  for review (a 2016 「現任立委」, a held-back type) becomes auto when this
 *  rule is sure of it. */
export async function fileTag(db: Db, tag: string, source: TagGroupSource, rows: Row[]) {
  const now = new Date();
  const existing = await db.select().from(tagGroupMembers).where(eq(tagGroupMembers.tag, tag));
  const have = new Map(existing.map((r) => [r.groupId, r]));
  let added = 0;
  for (const row of rows) {
    const old = have.get(row.groupId);
    const status = row.status ?? 'auto';
    if (!old) {
      await db
        .insert(tagGroupMembers)
        .values({ tag, groupId: row.groupId, source, status, score: row.score, note: row.note, updatedAt: now });
      added++;
    } else if (
      (old.status === 'auto' && (old.source === source || (row.score ?? 1) > (old.score ?? 1))) ||
      (old.status === 'review' && old.source !== source && old.source !== 'admin' && status === 'auto')
    ) {
      await db
        .update(tagGroupMembers)
        .set({ source, status, score: row.score, note: row.note, updatedAt: now })
        .where(and(eq(tagGroupMembers.tag, tag), eq(tagGroupMembers.groupId, row.groupId)));
    }
  }
  const keep = new Set(rows.map((r) => r.groupId));
  const stale = existing.filter((r) => r.source === source && r.status === 'auto' && !keep.has(r.groupId)).map((r) => r.groupId);
  if (stale.length)
    await db
      .delete(tagGroupMembers)
      .where(and(eq(tagGroupMembers.tag, tag), eq(tagGroupMembers.source, source), inArray(tagGroupMembers.groupId, stale)));
  return { added, removed: stale.length };
}

/** Tags on this week's news ranking (tag_stats level 3), busiest first. */
export async function rankedTags(db: Db, { limit = 500, days = 7 } = {}) {
  const rows = await db
    .select({ tag: tagStats.tag })
    .from(tagStats)
    .where(and(eq(tagStats.category, 'news'), eq(tagStats.level, 3), gte(tagStats.lastHour, new Date(Date.now() - days * 86_400_000))))
    .orderBy(desc(tagStats.hoursCount))
    .limit(limit * 2);
  return [...new Set(rows.map((r) => r.tag))].slice(0, limit);
}

/** Identity groups for every person matched by the avatar run (tag_people). */
export async function filePeople(db: Db) {
  const people = await db.select({ tag: tagPeople.tag, facts: tagPeople.facts }).from(tagPeople).where(isNotNull(tagPeople.wikidataId));
  let added = 0;
  for (const p of people) {
    if (!p.facts) continue;
    const picks = personGroups(p.facts);
    added += (
      await fileTag(
        db,
        p.tag,
        'person',
        picks.map((g) => ({ groupId: g.groupId, score: null, note: g.note })),
      )
    ).added;
  }
  return { people: people.length, added };
}

/** Wikidata types for tags the avatar run has not matched to a person;
 *  asks Wikidata again only after 30 days. A tag that turns out to be a
 *  person gets the person rules (same guards against nicknames and
 *  namesakes as the avatars; namesakes wait for review). Run after
 *  fileSections: the type rules check the tag's topics. */
export async function fileWikidata(db: Db, tags: string[], { force = false, log = (_o: object) => {} } = {}) {
  if (!tags.length) return { checked: 0, added: 0, errors: 0 };
  const people = new Set(
    (
      await db
        .select({ tag: tagPeople.tag })
        .from(tagPeople)
        .where(and(inArray(tagPeople.tag, tags), isNotNull(tagPeople.wikidataId)))
    ).map((r) => r.tag),
  );
  const cached = new Map((await db.select().from(tagWikidata).where(inArray(tagWikidata.tag, tags))).map((r) => [r.tag, r] as const));
  const topicIds = SEED_GROUPS.filter((g) => g.kind === 'topic').map((g) => g.id);
  const fresh = Date.now() - RECHECK_DAYS * 86_400_000;
  let checked = 0;
  let added = 0;
  let errors = 0;
  // One tag at a time, so a Wikidata hiccup costs that tag, not the run.
  const one = async (tag: string) => {
    if (people.has(tag)) return;
    const row = cached.get(tag);
    let types = row?.types ?? [];
    const recent = !force && row?.checkedAt && row.checkedAt.getTime() >= fresh;
    if (!recent) {
      const item = await findItem(tag);
      checked++;
      const values = {
        wikidataId: item?.qid ?? null,
        label: item?.label?.slice(0, 120) ?? null,
        description: item?.description?.slice(0, 255) ?? null,
        types: item?.types ?? null,
        checkedAt: new Date(),
      };
      await db
        .insert(tagWikidata)
        .values({ tag, ...values })
        .onDuplicateKeyUpdate({ set: values });
      log({ tag, qid: values.wikidataId, types: values.types?.map((t) => t.label) });
      types = item?.types ?? [];
    }
    if (types.some((t) => t.id === HUMAN)) {
      // A person's facts are not cached: asked again only with the item.
      if (recent) return;
      const person = await findPerson(tag);
      if (!person || person.aliasOnly) return;
      const status = person.namesakes ? 'review' : 'auto';
      const picks = personGroups(person.facts).map((g) => ({ groupId: g.groupId, score: null, note: g.note, status }) as const);
      added += (await fileTag(db, tag, 'person', picks)).added;
      return;
    }
    // Today's topics: the 2016 legacy counts are too old to back a type
    // (「失聯」 was a TV series then) unless an admin confirmed them.
    const topics = (
      await db
        .select({ groupId: tagGroupMembers.groupId, source: tagGroupMembers.source, status: tagGroupMembers.status })
        .from(tagGroupMembers)
        .where(
          and(
            eq(tagGroupMembers.tag, tag),
            inArray(tagGroupMembers.groupId, topicIds),
            inArray(tagGroupMembers.status, ['auto', 'confirmed']),
          ),
        )
    )
      .filter((r) => r.source !== 'legacy' || r.status === 'confirmed')
      .map((r) => r.groupId);
    const picks = typeGroups(types, topics).map((g) => ({
      groupId: g.groupId,
      score: null,
      note: g.review ? `${g.note}，版別不符` : g.note,
      status: g.review ? ('review' as const) : ('auto' as const),
    }));
    added += (await fileTag(db, tag, 'wikidata', picks)).added;
  };
  for (const tag of tags) {
    try {
      await one(tag);
    } catch (err) {
      errors++;
      log({ tag, error: String(err) });
    }
  }
  return { checked, added, errors };
}

/** Topics from the sections the tag's outlets file it under, over `days`. */
export async function fileSections(db: Db, tags: string[], { days = 90, batch = 100 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000);
  let added = 0;
  for (let i = 0; i < tags.length; i += batch) {
    const chunk = tags.slice(i, i + batch);
    // The first three URL path segments (…/news/politics/123).
    const path = sql<string>`SUBSTRING_INDEX(SUBSTRING_INDEX(${articles.url}, '/', 6), '/', -3)`;
    const rows = await db
      .select({ tag: articleTags.tag, media: articles.media, category: articles.category, path, n: sql<number>`COUNT(*)` })
      .from(articleTags)
      .innerJoin(articles, eq(articles.id, articleTags.articleId))
      .where(and(inArray(articleTags.tag, chunk), gte(articleTags.publishedAt, since)))
      .groupBy(articleTags.tag, articles.media, articles.category, path);
    const byTag = new Map<string, { media: string; topic: number; n: number }[]>();
    for (const r of rows) {
      const topic =
        sectionTopic(r.category) ??
        String(r.path)
          .split('/')
          .map(sectionTopic)
          .find((t) => t !== null) ??
        null;
      if (topic === null) continue;
      const list = byTag.get(r.tag) ?? [];
      list.push({ media: r.media, topic, n: Number(r.n) });
      byTag.set(r.tag, list);
    }
    for (const tag of chunk) {
      const topics = voteTopics(byTag.get(tag) ?? []);
      const rows = topics.map((t) => ({
        groupId: t.groupId,
        score: Math.round(t.share * 100) / 100,
        note: `${t.outlets} 家媒體 ${Math.round(t.share * 100)}%`,
      }));
      added += (await fileTag(db, tag, 'section', rows)).added;
    }
  }
  return { tags: tags.length, added };
}
