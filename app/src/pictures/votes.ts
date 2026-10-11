import { and, eq, gte, isNotNull, max, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { tagAvatarCandidates, tagPeople, tagPictureVotes, tagVisualCandidates, tagVisuals } from '../db/schema.ts';

// Readers' votes on a tag's picture (docs/tag-pictures.md). Every tag has
// candidates: a person tag's sketches (tag_avatar_candidates), any other
// tag's places, logos and emoji (tag_visual_candidates), plus what readers
// upload. The candidate with the most votes is shown; a tie keeps the one
// shown. An admin's choice (chosen) or hiding (hidden) overrides the votes,
// which keep counting and show again once the admin lets go.

export type PictureKind = 'avatar' | 'visual';

/** A person tag (matched to Wikidata) gets sketches; every other tag a picture. */
export async function pictureKind(db: Db, tag: string): Promise<PictureKind> {
  const [person] = await db
    .select({ tag: tagPeople.tag })
    .from(tagPeople)
    .where(and(eq(tagPeople.tag, tag), isNotNull(tagPeople.wikidataId)));
  return person ? 'avatar' : 'visual';
}

/** Votes per candidate rank. */
export async function tally(db: Db, tag: string, kind: PictureKind) {
  const rows = await db
    .select({ rank: tagPictureVotes.rank, n: sql<number>`COUNT(*)` })
    .from(tagPictureVotes)
    .where(and(eq(tagPictureVotes.tag, tag), eq(tagPictureVotes.kind, kind)))
    .groupBy(tagPictureVotes.rank);
  return new Map(rows.map((r) => [r.rank, Number(r.n)]));
}

/** The most-voted rank; a tie keeps `shown`, else the lowest rank. Null with no votes. */
export function leader(votes: Map<number, number>, shown: number | null) {
  let best: number | null = null;
  let most = 0;
  for (const [rank, n] of [...votes].sort((a, b) => a[0] - b[0])) if (n > most || (n === most && rank === shown)) [best, most] = [rank, n];
  return most > 0 ? best : null;
}

/** Puts the most-voted candidate in use, unless an admin chose or hid one. */
export async function applyVotes(db: Db, tag: string, kind: PictureKind) {
  const votes = await tally(db, tag, kind);
  if (kind === 'avatar') {
    const [row] = await db
      .select({ status: tagPeople.status, shownRank: tagPeople.shownRank })
      .from(tagPeople)
      .where(eq(tagPeople.tag, tag));
    if (!row || row.status === 'chosen' || row.status === 'hidden') return row?.shownRank ?? null;
    const rank = leader(votes, row.shownRank);
    if (rank === null) return row.shownRank;
    await db.update(tagPeople).set({ status: 'voted', shownRank: rank, note: null }).where(eq(tagPeople.tag, tag));
    return rank;
  }
  const [row] = await db
    .select({ status: tagVisuals.status, shownRank: tagVisuals.shownRank })
    .from(tagVisuals)
    .where(eq(tagVisuals.tag, tag));
  if (!row || row.status === 'chosen' || row.status === 'hidden') return row?.shownRank ?? null;
  const rank = leader(votes, row.shownRank);
  if (rank === null) return row.shownRank;
  const [c] = await db
    .select()
    .from(tagVisualCandidates)
    .where(and(eq(tagVisualCandidates.tag, tag), eq(tagVisualCandidates.rank, rank)));
  if (!c) return row.shownRank;
  const { tag: _, rank: __, uploadedBy: ___, uploadedAt: ____, ...picture } = c;
  if (rank === row.shownRank && row.status === 'voted') return rank;
  // checkedAt moves the image URL's version, so browsers fetch the new picture.
  await db
    .update(tagVisuals)
    .set({ ...picture, status: 'voted', shownRank: rank, checkedAt: new Date() })
    .where(eq(tagVisuals.tag, tag));
  return rank;
}

/** One vote per reader per tag; `rank` null takes the vote back. */
export async function castVote(db: Db, tag: string, kind: PictureKind, userId: number, rank: number | null) {
  if (rank === null)
    await db
      .delete(tagPictureVotes)
      .where(and(eq(tagPictureVotes.tag, tag), eq(tagPictureVotes.kind, kind), eq(tagPictureVotes.userId, userId)));
  else {
    const at = new Date();
    await db.insert(tagPictureVotes).values({ tag, kind, userId, rank, at }).onDuplicateKeyUpdate({ set: { rank, at } });
  }
  return applyVotes(db, tag, kind);
}

/** The next free candidate rank. */
export async function nextRank(db: Db, tag: string, kind: PictureKind) {
  const table = kind === 'avatar' ? tagAvatarCandidates : tagVisualCandidates;
  const [{ top }] = await db
    .select({ top: max(table.rank) })
    .from(table)
    .where(eq(table.tag, tag));
  return (top ?? 0) + 1;
}

/**
 * A reader's picture for a non-person tag, already recoloured (recolourLogo):
 * the next candidate, voted for by the uploader, so it is shown at once
 * unless more readers voted for another or an admin chose one.
 */
export async function addVisualUpload(db: Db, tag: string, image: Buffer, userId: number) {
  const at = new Date();
  const rank = await nextRank(db, tag, 'visual');
  await db.insert(tagVisualCandidates).values({ tag, rank, kind: 'logo', note: '讀者上傳', image, uploadedBy: userId, uploadedAt: at });
  // A tag nothing was found for has no row yet.
  await db.insert(tagVisuals).ignore().values({ tag, status: 'voted', checkedAt: at });
  await db
    .update(tagVisuals)
    .set({ status: 'voted' })
    .where(and(eq(tagVisuals.tag, tag), sql`${tagVisuals.status} NOT IN ('chosen', 'hidden')`));
  await castVote(db, tag, 'visual', userId, rank);
  return { tag, rank };
}

/** Uploads by `userId` over the last day, both kinds. */
export async function uploadsToday(db: Db, userId: number) {
  const since = new Date(Date.now() - 86_400_000);
  const count = async (table: typeof tagAvatarCandidates | typeof tagVisualCandidates) =>
    Number(
      (
        await db
          .select({ n: sql<number>`COUNT(*)` })
          .from(table)
          .where(and(eq(table.uploadedBy, userId), gte(table.uploadedAt, since)))
      )[0]?.n ?? 0,
    );
  return (await count(tagAvatarCandidates)) + (await count(tagVisualCandidates));
}
