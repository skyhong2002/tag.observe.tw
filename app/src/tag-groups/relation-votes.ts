import { and, desc, eq, gte, inArray, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import type { Db } from '../db/client.ts';
import {
  articles,
  articleTags,
  tagGroupDefs,
  tagGroupMemberLog,
  tagGroupMembers,
  tagPeople,
  tagRelationVotes,
  tagSubmissionLog,
  tagSubmissions,
} from '../db/schema.ts';
import { isTagNoise } from '../tag-noise.ts';
import { CURATED_GROUPS } from './rules.ts';
import { publicRelations, type RelationType, relationKey } from './semantic.ts';
import { syncWritingTag } from './writing.ts';

// Readers decide tag relations by vote (owner's decisions, 2026-10-15):
// - a relation is established once at least one reader other than its proposer
//   agrees and agreements outnumber disagreements by at least one;
// - candidates are reader proposals, the classification suggestions waiting in
//   tag_group_members (status 'review'), the tags that most often appear on the
//   same articles, and Wikidata's aliases that headlines actually use;
// - no AI suggestion is put to readers, and curated rosters (CURATED_GROUPS:
//   2024 立委, 2022 縣市長…) are kept from official lists, not voted on
//   (owner's decisions, 2026-10-16);
// - relations established before voting (or locked by an administrator) are
//   not put to a vote; only vote-decided ones can fall back to voting.
export const established = (agree: number, disagree: number) => agree >= 1 && agree - disagree >= 1;
/** reviewed_by / reviewedBy marker for what the votes decided (not a person). */
export const VOTES = 'votes';
const COOCCUR_DAYS = 3;
const COOCCUR_SHOWN = 5;
const ALIAS_DAYS = 14;
const CURATED = [...CURATED_GROUPS];

const SOURCE_LABEL: Record<string, string> = {
  submission: '讀者提出',
  manual: '管理員提出',
  cooccur: '常一起出現',
  ai: 'AI 建議',
  wikidata: 'Wikidata',
  legacy: '舊分類',
  person: '人物資料',
  section: '版面分類',
  admin: '管理員',
};

export type RelationCandidate = {
  key: string;
  type: RelationType;
  target: string;
  /** Where the candidate came from: a proposal row, a waiting classification suggestion, co-occurrence or a Wikidata alias. */
  origin: 'submission' | 'suggestion' | 'cooccur' | 'alias';
  source: string;
  sourceLabel: string;
  note: string | null;
  /** Why it is asked: the proposer's reason, the rule's note, a headline. */
  evidence: { text: string; href?: string }[];
  submissionId: number | null;
  groupId: number | null;
  status: 'voting' | 'established';
  agree: number;
  disagree: number;
  myVote: -1 | 0 | 1;
  /** The viewer proposed it and cannot vote for it. */
  mine: boolean;
};

type Internal = RelationCandidate & { proposerId: number | null };

/** Tags most often on the same articles in the last few days, noise removed. */
async function cooccurring(db: Db, tag: string, limit: number) {
  const other = alias(articleTags, 'other');
  const since = new Date(Date.now() - COOCCUR_DAYS * 86_400_000);
  const exactOther = sql<string>`${other.tag} COLLATE utf8mb4_bin`;
  const rows = await db
    .select({ tag: exactOther, count: sql<number>`COUNT(*)`, sample: sql<number>`MAX(${articleTags.articleId})` })
    .from(articleTags)
    .innerJoin(other, and(eq(other.articleId, articleTags.articleId), ne(other.tag, articleTags.tag)))
    .where(and(eq(articleTags.tag, tag), sql`BINARY ${articleTags.tag} = BINARY ${tag}`, gte(articleTags.publishedAt, since)))
    .groupBy(exactOther)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit * 3);
  return rows
    .filter((r) => r.tag !== tag && !isTagNoise(r.tag))
    .map((r) => ({ tag: r.tag, count: Number(r.count), sample: Number(r.sample) }));
}

/** Wikidata's Chinese aliases for a person tag, with how many recent headlines on the tag use each. */
async function aliasesInTitles(db: Db, tag: string) {
  const [person] = await db.select({ facts: tagPeople.facts }).from(tagPeople).where(eq(tagPeople.tag, tag));
  const aliases = (person?.facts?.aliases ?? []).filter((a) => a !== tag && [...a].length <= 60);
  if (!aliases.length) return [];
  const titles = await db
    .select({ id: articles.id, title: articles.title })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(
      and(
        eq(articleTags.tag, tag),
        sql`BINARY ${articleTags.tag} = BINARY ${tag}`,
        gte(articleTags.publishedAt, new Date(Date.now() - ALIAS_DAYS * 86_400_000)),
      ),
    )
    .orderBy(desc(articleTags.publishedAt))
    .limit(400);
  return aliases
    .map((alias) => {
      const hits = titles.filter((t) => t.title.includes(alias));
      return { alias, count: hits.length, sample: hits[0] ?? null };
    })
    .filter((a) => a.count > 0);
}

async function candidatesOf(db: Db, tag: string, userId: number | null): Promise<Internal[]> {
  const [submissions, members, publicView] = await Promise.all([
    db
      .select()
      .from(tagSubmissions)
      .where(
        and(
          eq(tagSubmissions.kind, 'relation'),
          or(
            sql`BINARY ${tagSubmissions.tag} = BINARY ${tag}`,
            and(sql`BINARY ${tagSubmissions.target} = BINARY ${tag}`, inArray(tagSubmissions.relationType, ['related', 'alias'])),
          ),
        ),
      )
      .limit(500),
    db
      .select({
        groupId: tagGroupMembers.groupId,
        source: tagGroupMembers.source,
        status: tagGroupMembers.status,
        note: tagGroupMembers.note,
        reviewedBy: tagGroupMembers.reviewedBy,
        label: tagGroupDefs.label,
      })
      .from(tagGroupMembers)
      .innerJoin(tagGroupDefs, eq(tagGroupDefs.id, tagGroupMembers.groupId))
      .where(
        and(
          eq(tagGroupMembers.tag, tag),
          sql`BINARY ${tagGroupMembers.tag} = BINARY ${tag}`,
          eq(tagGroupDefs.kind, 'group'),
          isNull(tagGroupDefs.deletedAt),
          notInArray(tagGroupMembers.groupId, CURATED),
          ne(tagGroupMembers.source, 'ai'),
          or(eq(tagGroupMembers.status, 'review'), and(eq(tagGroupMembers.status, 'confirmed'), eq(tagGroupMembers.reviewedBy, VOTES))),
        ),
      )
      .limit(200),
    publicRelations(db, tag),
  ]);
  const out: Internal[] = [];
  const seen = new Set<string>();
  const base = { agree: 0, disagree: 0, myVote: 0 as const, mine: false };
  for (const row of submissions) {
    if (!row.relationType || !row.target) continue;
    if (row.targetGroupId !== null && CURATED_GROUPS.has(row.targetGroupId)) {
      seen.add(row.dedupeKey);
      continue;
    }
    // Votes decide only rows nobody locked: pending, or approved by votes (no reviewer).
    if (row.reviewedBy !== null || (row.status !== 'pending' && row.status !== 'approved')) {
      seen.add(row.dedupeKey);
      continue;
    }
    seen.add(row.dedupeKey);
    out.push({
      ...base,
      key: row.dedupeKey,
      type: row.relationType,
      target: row.tag === tag ? row.target : row.tag,
      origin: 'submission',
      source: row.source,
      sourceLabel: SOURCE_LABEL[row.source] ?? row.source,
      note: row.reason,
      evidence: row.reason ? [{ text: row.reason }] : [],
      submissionId: row.id,
      groupId: row.targetGroupId,
      status: row.status === 'approved' ? 'established' : 'voting',
      proposerId: row.createdBy || null,
    });
  }
  for (const m of members) {
    const key = relationKey(tag, 'is-a', { groupId: m.groupId });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...base,
      key,
      type: 'is-a',
      target: m.label,
      origin: 'suggestion',
      source: m.source,
      sourceLabel: SOURCE_LABEL[m.source] ?? m.source,
      note: m.note,
      evidence: m.note ? [{ text: m.note }] : [],
      submissionId: null,
      groupId: m.groupId,
      status: m.status === 'confirmed' ? 'established' : 'voting',
      proposerId: null,
    });
  }
  // Established relations (and anything already decided) are not offered again.
  for (const r of publicView.relations) {
    if (r.inherited) continue;
    const groupId = r.target.id.startsWith('group:') ? Number(r.target.id.slice(6)) : null;
    seen.add(relationKey(tag, r.type, groupId === null ? r.target.label : { groupId }));
  }
  const [together, aliases] = await Promise.all([cooccurring(db, tag, COOCCUR_SHOWN), aliasesInTitles(db, tag)]);
  const shown = together.filter((c) => !seen.has(relationKey(tag, 'related', c.tag))).slice(0, COOCCUR_SHOWN);
  const samples = shown.length
    ? await db
        .select({ id: articles.id, title: articles.title })
        .from(articles)
        .where(
          inArray(
            articles.id,
            shown.map((c) => c.sample),
          ),
        )
    : [];
  for (const c of shown) {
    const key = relationKey(tag, 'related', c.tag);
    seen.add(key);
    const sample = samples.find((a) => a.id === c.sample);
    out.push({
      ...base,
      key,
      type: 'related',
      target: c.tag,
      origin: 'cooccur',
      source: 'cooccur',
      sourceLabel: SOURCE_LABEL.cooccur,
      note: `近 ${COOCCUR_DAYS} 天一起出現在 ${c.count} 篇`,
      evidence: [
        { text: `近 ${COOCCUR_DAYS} 天一起出現在 ${c.count} 篇` },
        ...(sample ? [{ text: `「${sample.title}」`, href: `/article/${sample.id}/` }] : []),
      ],
      submissionId: null,
      groupId: null,
      status: 'voting',
      proposerId: null,
    });
  }
  for (const a of aliases) {
    const key = relationKey(tag, 'alias', a.alias);
    if (seen.has(key)) continue;
    seen.add(key);
    const note = `Wikidata 列為別名；近 ${ALIAS_DAYS} 天 ${a.count} 則標題這樣寫`;
    out.push({
      ...base,
      key,
      type: 'alias',
      target: a.alias,
      origin: 'alias',
      source: 'wikidata',
      sourceLabel: SOURCE_LABEL.wikidata,
      note,
      evidence: [
        { text: `Wikidata 列為「${tag}」的別名` },
        { text: `近 ${ALIAS_DAYS} 天 ${a.count} 則標題寫「${a.alias}」` },
        ...(a.sample ? [{ text: `「${a.sample.title}」`, href: `/article/${a.sample.id}/` }] : []),
      ],
      submissionId: null,
      groupId: null,
      status: 'voting',
      proposerId: null,
    });
  }
  if (!out.length) return out;
  const votes = await db
    .select({ key: tagRelationVotes.relationKey, userId: tagRelationVotes.userId, value: tagRelationVotes.value })
    .from(tagRelationVotes)
    .where(
      inArray(
        tagRelationVotes.relationKey,
        out.map((c) => c.key),
      ),
    );
  for (const c of out) {
    for (const v of votes) {
      if (v.key !== c.key) continue;
      if (v.userId === userId) c.myVote = (Math.sign(v.value) || 0) as -1 | 0 | 1;
      if (v.userId === c.proposerId) continue;
      if (v.value > 0) c.agree++;
      else if (v.value < 0) c.disagree++;
    }
    c.mine = userId !== null && c.proposerId === userId;
  }
  return out;
}

/** Candidates for the relations page; anonymous readers see counts without myVote. */
export async function relationCandidates(db: Db, tag: string, userId: number | null): Promise<RelationCandidate[]> {
  return (await candidatesOf(db, tag, userId)).map(({ proposerId: _, ...c }) => c);
}

// The tag page asks for the count on every render; a short memory keeps the
// co-occurrence and headline lookups off most of them. The gateway and the
// API are separate processes, so a vote on one may show on the other's tag
// page up to a minute later (the page itself revalidates every minute).
const counted = new Map<string, { at: number; n: number }>();
const COUNT_TTL = 60e3;

/** A proposal, review or vote changed the tag's ballot. */
export const forgetVotingCount = (tag: string) => counted.delete(tag);

export async function votingCount(db: Db, tag: string) {
  const hit = counted.get(tag);
  if (hit && Date.now() - hit.at < COUNT_TTL) return hit.n;
  const n = (await candidatesOf(db, tag, null)).filter((c) => c.status === 'voting').length;
  if (counted.size > 2000) counted.clear();
  counted.set(tag, { at: Date.now(), n });
  return n;
}

export class VoteRefused extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

type Effects = {
  apply: (tx: Db, row: typeof tagSubmissions.$inferSelect, email: string) => Promise<void>;
  revoke: (tx: Db, row: typeof tagSubmissions.$inferSelect, email: string) => Promise<void>;
};

/**
 * Records one reader's vote (1 agree, -1 disagree, 0 withdraw) and settles the
 * relation. Caller runs this inside a transaction holding tag_relation_lock.
 */
export async function castRelationVote(tx: Db, effects: Effects, userId: number, tag: string, key: string, value: -1 | 0 | 1) {
  const candidate = (await candidatesOf(tx, tag, userId)).find((c) => c.key === key);
  if (!candidate) throw new VoteRefused('這筆關係目前不在投票中', 404);
  if (candidate.mine) throw new VoteRefused('不能投自己提出的關係，請讓其他讀者決定', 403);
  const at = new Date();
  // A co-occurrence or alias candidate becomes a proposal row on its first
  // vote, so it can be settled, listed and revoked like any other.
  if (candidate.origin === 'cooccur' || candidate.origin === 'alias') {
    await tx
      .insert(tagSubmissions)
      .values({
        kind: 'relation',
        tag,
        relationType: candidate.type,
        target: candidate.target,
        reason: candidate.note,
        source: candidate.origin === 'alias' ? 'wikidata' : 'cooccur',
        status: 'pending',
        createdBy: 0,
        createdAt: at,
        dedupeKey: key,
      })
      .onDuplicateKeyUpdate({ set: { dedupeKey: key } });
  }
  if (value === 0) await tx.delete(tagRelationVotes).where(and(eq(tagRelationVotes.relationKey, key), eq(tagRelationVotes.userId, userId)));
  else await tx.insert(tagRelationVotes).values({ relationKey: key, userId, value, tag, at }).onDuplicateKeyUpdate({ set: { value, at } });
  await settle(tx, effects, tag, candidate, userId);
  forgetVotingCount(tag);
}

async function tally(tx: Db, key: string, proposerId: number | null) {
  const rows = await tx
    .select({ userId: tagRelationVotes.userId, value: tagRelationVotes.value })
    .from(tagRelationVotes)
    .where(eq(tagRelationVotes.relationKey, key));
  const counted = rows.filter((r) => r.userId !== proposerId);
  return established(counted.filter((r) => r.value > 0).length, counted.filter((r) => r.value < 0).length);
}

async function settle(tx: Db, effects: Effects, tag: string, candidate: Internal, voter: number) {
  const [row] = await tx.select().from(tagSubmissions).where(eq(tagSubmissions.dedupeKey, candidate.key)).for('update');
  const at = new Date();
  if (row) {
    if (row.reviewedBy !== null || (row.status !== 'pending' && row.status !== 'approved')) return;
    const want = await tally(tx, candidate.key, row.createdBy || null);
    if (want && row.status === 'pending') {
      await effects.apply(tx, row, VOTES);
      await tx
        .update(tagSubmissions)
        .set({ status: 'approved', reviewedAt: at, reviewReason: '讀者投票成立' })
        .where(eq(tagSubmissions.id, row.id));
      await tx.insert(tagSubmissionLog).values({ submissionId: row.id, action: 'vote-approved', userId: voter, at });
    }
    if (!want && row.status === 'approved') {
      await effects.revoke(tx, row, VOTES);
      await tx.update(tagSubmissions).set({ status: 'pending', reviewedAt: null, reviewReason: null }).where(eq(tagSubmissions.id, row.id));
      await tx.insert(tagSubmissionLog).values({ submissionId: row.id, action: 'vote-reverted', userId: voter, at });
    }
    return;
  }
  if (candidate.origin !== 'suggestion' || candidate.groupId === null) return;
  // Suggestions are listed for the page's own tag, so that is the member.
  const where = and(eq(tagGroupMembers.tag, tag), eq(tagGroupMembers.groupId, candidate.groupId));
  const [member] = await tx.select().from(tagGroupMembers).where(where).for('update');
  if (!member) return;
  const want = await tally(tx, candidate.key, null);
  if (want && member.status === 'review') {
    await tx.update(tagGroupMembers).set({ status: 'confirmed', reviewedBy: VOTES, reviewedAt: at, updatedAt: at }).where(where);
    await tx
      .insert(tagGroupMemberLog)
      .values({ tag: member.tag, groupId: member.groupId, action: 'confirm', fromStatus: 'review', email: VOTES, at });
    await syncWritingTag(tx, member.tag, VOTES);
  }
  if (!want && member.status === 'confirmed' && member.reviewedBy === VOTES) {
    await tx.update(tagGroupMembers).set({ status: 'review', reviewedBy: null, reviewedAt: null, updatedAt: at }).where(where);
    await tx
      .insert(tagGroupMemberLog)
      .values({ tag: member.tag, groupId: member.groupId, action: 'revoke', fromStatus: 'confirmed', email: VOTES, at });
    await syncWritingTag(tx, member.tag, VOTES);
  }
}
