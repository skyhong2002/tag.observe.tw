import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import {
  tagAvatarCandidates,
  tagPeople,
  tagPictureVotes,
  tagSubmissionLog,
  tagSubmissions,
  tagVisualCandidates,
  tagVisuals,
  users,
} from '../db/schema.ts';
import { applyVotes, nextRank, type PictureKind, uploadsToday } from './votes.ts';

export type PictureMetadata = { score: number; scores: Record<string, number>; verdict: string };
/** What the tag showed before a reader's picture went public, so taking it down restores it. */
type Previous = { status: string | null; shownRank: number | null };
export const AUTO_PUBLISHED = '投稿即公開（管理員可撤下）';
export const pictureSubmissionKey = (tag: string, kind: PictureKind, image: Buffer) =>
  createHash('sha256')
    .update(JSON.stringify(['picture', tag, kind]))
    .update(image)
    .digest('hex');

/**
 * Readers' pictures become public candidates as soon as they are submitted, with
 * no review (owner's decision, 2026-10-15): other readers' votes decide whether
 * one is shown, and an administrator can take one down (revokePicture).
 */
export async function submitPicture(
  db: Db,
  input: { tag: string; pictureKind: PictureKind; image: Buffer; userId: number; pictureMeta?: PictureMetadata },
) {
  const { tag, pictureKind, image, userId, pictureMeta } = input;
  const dedupeKey = pictureSubmissionKey(tag, pictureKind, image);
  return db.transaction(async (tx) => {
    // Serialise the daily allowance per reader; different readers do not block each other.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const [existing] = await tx
      .select({ id: tagSubmissions.id, status: tagSubmissions.status })
      .from(tagSubmissions)
      .where(eq(tagSubmissions.dedupeKey, dedupeKey));
    if (existing) return { tag, submissionId: existing.id, status: existing.status };
    if ((await uploadsToday(tx as unknown as Db, userId)) >= 20) throw Error('每人每天最多上傳 20 張');
    if (pictureKind === 'avatar') {
      const [person] = await tx
        .select({ status: tagPeople.status, wikidataId: tagPeople.wikidataId })
        .from(tagPeople)
        .where(eq(tagPeople.tag, tag))
        .for('update');
      if (!person?.wikidataId || person.status === 'nonhuman') throw Error('這個標籤已更正為非人物，請重新上傳一般圖片');
    }
    const [inserted] = await tx
      .insert(tagSubmissions)
      .values({
        kind: 'picture',
        tag,
        source: 'submission',
        status: 'pending',
        createdBy: userId,
        createdAt: new Date(),
        dedupeKey,
        pictureKind,
        image,
        pictureMeta: pictureMeta ?? null,
        rightsConfirmed: true,
      })
      .onDuplicateKeyUpdate({ set: { dedupeKey } });
    const [row] = await tx
      .select({ id: tagSubmissions.id, status: tagSubmissions.status })
      .from(tagSubmissions)
      .where(eq(tagSubmissions.dedupeKey, dedupeKey))
      .for('update');
    if (inserted.affectedRows === 1 && inserted.insertId) {
      await tx.insert(tagSubmissionLog).values({ submissionId: row.id, action: 'submit', userId, at: new Date() });
      const [full] = await tx.select().from(tagSubmissions).where(eq(tagSubmissions.id, row.id)).for('update');
      await publishPicture(tx as unknown as Db, full, null, AUTO_PUBLISHED);
      return { tag, submissionId: row.id, status: 'approved' as const };
    }
    return { tag, submissionId: row.id, status: row.status };
  });
}

/** Caller holds the submission row lock and records its review in this same transaction. */
export async function approvePicture(db: Db, row: typeof tagSubmissions.$inferSelect) {
  if (row.kind !== 'picture' || !row.pictureKind || !row.image || !row.rightsConfirmed) throw Error('圖片投稿不完整');
  if (row.status !== 'pending' || row.candidateRank !== null) throw Error('這筆投稿已經審核');
  const { tag, pictureKind: kind } = row;
  let previous: Previous;
  if (kind === 'avatar') {
    const [person] = await db
      .select({ status: tagPeople.status, wikidataId: tagPeople.wikidataId, shownRank: tagPeople.shownRank })
      .from(tagPeople)
      .where(eq(tagPeople.tag, tag))
      .for('update');
    if (!person?.wikidataId || person.status === 'nonhuman') throw Error('這個標籤已更正為非人物，請重新投稿一般圖片');
    previous = { status: person.status, shownRank: person.shownRank };
  } else {
    // The row is also the per-tag rank allocation lock. Never replace an administrator's choice.
    await db.insert(tagVisuals).ignore().values({ tag, status: 'none', checkedAt: new Date() });
    const [visual] = await db
      .select({ status: tagVisuals.status, shownRank: tagVisuals.shownRank })
      .from(tagVisuals)
      .where(eq(tagVisuals.tag, tag))
      .for('update');
    previous = { status: visual?.status ?? null, shownRank: visual?.shownRank ?? null };
  }
  const rank = await nextRank(db, tag, kind);
  if (kind === 'avatar') {
    const meta = row.pictureMeta;
    if (!meta) throw Error('人物圖片缺少處理結果');
    await db.insert(tagAvatarCandidates).values({
      tag,
      rank,
      file: '讀者上傳',
      pageUrl: '',
      score: meta.score,
      scores: meta.scores,
      verdict: meta.verdict,
      image: row.image,
      uploadedBy: row.createdBy,
      uploadedAt: row.createdAt,
    });
  } else {
    await db.insert(tagVisualCandidates).values({
      tag,
      rank,
      kind: 'logo',
      note: '讀者上傳',
      image: row.image,
      uploadedBy: row.createdBy,
      uploadedAt: row.createdAt,
    });
  }
  // A new candidate carries no votes, not even the uploader's (who cannot vote
  // for it): it is shown only once other readers' votes put it ahead.
  const shownRank = await applyVotes(db, tag, kind);
  return { rank, shownRank, previous };
}

/** Puts a locked pending picture row in public and records who/why; `reviewer` null means automatic. */
export async function publishPicture(db: Db, row: typeof tagSubmissions.$inferSelect, reviewer: number | null, reason: string) {
  const { rank, previous } = await approvePicture(db, row);
  const at = new Date();
  await db
    .update(tagSubmissions)
    .set({
      status: 'approved',
      reviewedBy: reviewer,
      reviewedAt: at,
      reviewReason: reason,
      candidateRank: rank,
      pictureMeta: { ...(row.pictureMeta ?? {}), previous } as PictureMetadata,
    })
    .where(eq(tagSubmissions.id, row.id));
  await db.insert(tagSubmissionLog).values({
    submissionId: row.id,
    action: reviewer === null ? 'auto-approved' : 'approved',
    userId: reviewer ?? row.createdBy,
    at,
    reason,
  });
  return rank;
}

/**
 * Takes a published reader picture down: its candidate and the votes for it go,
 * and the tag goes back to what it showed before, or what the remaining votes pick.
 * Caller holds the submission row lock.
 */
export async function revokePicture(db: Db, row: typeof tagSubmissions.$inferSelect) {
  const { tag, pictureKind: kind, candidateRank: rank } = row;
  if (row.kind !== 'picture' || !kind || rank === null) throw Error('這筆圖片投稿沒有公開中的候選圖');
  const recorded = (row.pictureMeta as { previous?: Previous } | null)?.previous;
  // Pictures approved before 2026-10-15 kept no snapshot: fall back to the best remaining candidate.
  const remaining = async () => {
    const table = kind === 'avatar' ? tagAvatarCandidates : tagVisualCandidates;
    const [first] = await db
      .select({ rank: table.rank })
      .from(table)
      .where(and(eq(table.tag, tag), sql`${table.rank} <> ${rank}`))
      .orderBy(table.rank)
      .limit(1);
    return first?.rank ?? null;
  };
  const previous: Previous = recorded ?? { status: 'auto', shownRank: await remaining() };
  await db.delete(tagPictureVotes).where(and(eq(tagPictureVotes.tag, tag), eq(tagPictureVotes.kind, kind), eq(tagPictureVotes.rank, rank)));
  if (kind === 'avatar') {
    const [person] = await db.select({ shownRank: tagPeople.shownRank }).from(tagPeople).where(eq(tagPeople.tag, tag)).for('update');
    await db.delete(tagAvatarCandidates).where(and(eq(tagAvatarCandidates.tag, tag), eq(tagAvatarCandidates.rank, rank)));
    if (person?.shownRank === rank)
      await db
        .update(tagPeople)
        .set({ status: (previous.status ?? 'voted') as typeof tagPeople.$inferSelect.status, shownRank: previous.shownRank })
        .where(and(eq(tagPeople.tag, tag), sql`${tagPeople.status} <> 'nonhuman'`));
  } else {
    const [visual] = await db.select({ shownRank: tagVisuals.shownRank }).from(tagVisuals).where(eq(tagVisuals.tag, tag)).for('update');
    await db.delete(tagVisualCandidates).where(and(eq(tagVisualCandidates.tag, tag), eq(tagVisualCandidates.rank, rank)));
    if (visual?.shownRank === rank) {
      const [before] =
        previous.shownRank === null
          ? []
          : await db
              .select()
              .from(tagVisualCandidates)
              .where(and(eq(tagVisualCandidates.tag, tag), eq(tagVisualCandidates.rank, previous.shownRank)));
      if (before) {
        const { tag: _, rank: __, uploadedBy: ___, uploadedAt: ____, ...picture } = before;
        await db
          .update(tagVisuals)
          .set({
            ...picture,
            status: (previous.status ?? 'voted') as typeof tagVisuals.$inferSelect.status,
            shownRank: previous.shownRank,
            checkedAt: new Date(),
          })
          .where(eq(tagVisuals.tag, tag));
      } else await db.update(tagVisuals).set({ status: 'none', shownRank: null, checkedAt: new Date() }).where(eq(tagVisuals.tag, tag));
    }
  }
  await applyVotes(db, tag, kind);
}
