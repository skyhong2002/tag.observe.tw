import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { tagAvatarCandidates, tagPeople, tagSubmissionLog, tagSubmissions, tagVisualCandidates, tagVisuals, users } from '../db/schema.ts';
import { castVote, nextRank, type PictureKind, uploadsToday } from './votes.ts';

export type PictureMetadata = { score: number; scores: Record<string, number>; verdict: string };
export const pictureSubmissionKey = (tag: string, kind: PictureKind, image: Buffer) =>
  createHash('sha256')
    .update(JSON.stringify(['picture', tag, kind]))
    .update(image)
    .digest('hex');

/** Processed images stay private until an administrator approves the submission. */
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
    }
    return { tag, submissionId: row.id, status: row.status };
  });
}

/** Caller holds the submission row lock and records its review in this same transaction. */
export async function approvePicture(db: Db, row: typeof tagSubmissions.$inferSelect) {
  if (row.kind !== 'picture' || !row.pictureKind || !row.image || !row.rightsConfirmed) throw Error('圖片投稿不完整');
  if (row.status !== 'pending' || row.candidateRank !== null) throw Error('這筆投稿已經審核');
  const { tag, pictureKind: kind } = row;
  if (kind === 'avatar') {
    const [person] = await db
      .select({ status: tagPeople.status, wikidataId: tagPeople.wikidataId })
      .from(tagPeople)
      .where(eq(tagPeople.tag, tag))
      .for('update');
    if (!person?.wikidataId || person.status === 'nonhuman') throw Error('這個標籤已更正為非人物，請重新投稿一般圖片');
  } else {
    // The row is also the per-tag rank allocation lock. Never replace an administrator's choice.
    await db.insert(tagVisuals).ignore().values({ tag, status: 'none', checkedAt: new Date() });
    await db.select({ tag: tagVisuals.tag }).from(tagVisuals).where(eq(tagVisuals.tag, tag)).for('update');
  }
  const rank = await nextRank(db, tag, kind);
  if (kind === 'avatar') {
    const meta = row.pictureMeta;
    if (!meta) throw Error('人物圖片缺少處理結果');
    await db.insert(tagAvatarCandidates).values({
      tag,
      rank,
      file: '讀者上傳（已審核）',
      pageUrl: '',
      score: meta.score,
      scores: meta.scores,
      verdict: meta.verdict,
      image: row.image,
      uploadedBy: row.createdBy,
      uploadedAt: row.createdAt,
    });
    await db
      .update(tagPeople)
      .set({ status: 'voted' })
      .where(and(eq(tagPeople.tag, tag), sql`${tagPeople.status} NOT IN ('chosen', 'hidden', 'nonhuman')`));
  } else {
    await db.insert(tagVisualCandidates).values({
      tag,
      rank,
      kind: 'logo',
      note: '讀者上傳（已審核）',
      image: row.image,
      uploadedBy: row.createdBy,
      uploadedAt: row.createdAt,
    });
  }
  // Approval enables the existing vote mechanism; before this point no vote/candidate existed.
  const shownRank = await castVote(db, tag, kind, row.createdBy, rank);
  return { rank, shownRank };
}
