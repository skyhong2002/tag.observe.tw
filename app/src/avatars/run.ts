import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articleTags, type TagPersonStatus, tagAvatarCandidates, tagPeople } from '../db/schema.ts';
import { inspect, quality, renderAvatar, sameFace, sameShot, type Verdict } from './portrait.ts';
import { alignFace, cosine, decode, embed, type Rgb } from './vision.ts';
import { candidateFiles, download, type FileInfo, fileInfo, findPerson } from './wikidata.ts';

// One person tag → Wikidata person → best Commons photos → sketch avatars
// (docs/tag-avatars.md). Every photo that passes is scored; the best is
// shown and the next two are kept so an admin can switch.

const KEEP = 3;
const LOW = 0.55; // best score under this → review
const RECHECK_DAYS = 30;

type Log = (obj: object, msg: string) => void;

/** Commons names derived crops "X (cropped).jpg", "X (cropped 2).jpg" after their source "X.jpg". */
export const shotName = (file: string) =>
  file
    .replace(/\.[a-z]+$/i, '')
    .replace(/\s*\(cropped[^)]*\)/gi, '')
    .trim()
    .toLowerCase();

type Seen = {
  info: FileInfo;
  bytes: Uint8Array;
  img: Rgb;
  verdict: Verdict | 'other';
  insp: Awaited<ReturnType<typeof inspect>>;
};

/** Embeddings of up to four faces in the first photo; the one most other photos agree with is the person. */
async function reference(seen: Seen[]) {
  const mains = seen.slice(1).flatMap((s) => (s.insp.embedding ? [s.insp.embedding] : []));
  const [first] = seen;
  const options = first?.insp.faces.length
    ? await Promise.all(first.insp.faces.slice(0, 4).map((f) => embed(alignFace(first.img, f))))
    : mains;
  let best: Float32Array | null = null;
  let votes = -1;
  for (const o of options) {
    const v = mains.filter((m) => m !== o && sameFace(o, m)).length;
    if (v > votes) [best, votes] = [o, v];
  }
  // Without a Wikidata photo, two photos must agree before anyone counts as the person.
  if (!first?.insp.faces.length && votes < 1) return null;
  return best;
}

export async function processTag(db: Db, tag: string, { log = (() => {}) as Log, force = false } = {}) {
  const [prior] = await db.select().from(tagPeople).where(eq(tagPeople.tag, tag));
  if (prior && !force && (prior.status === 'chosen' || prior.status === 'hidden')) return { tag, status: prior.status, skipped: true };
  const now = new Date();
  const person = await findPerson(tag);
  const save = async (status: TagPersonStatus, note: string | null, rows: (typeof tagAvatarCandidates.$inferInsert)[]) => {
    const row = {
      tag,
      wikidataId: person?.qid ?? null,
      label: person?.label?.slice(0, 120) ?? null,
      description: person?.description?.slice(0, 255) ?? null,
      facts: person?.facts ?? null,
      status,
      note,
      shownRank: rows.length ? 1 : null,
      checkedAt: now,
      reviewedBy: null,
      reviewedAt: null,
    };
    await db.transaction(async (tx) => {
      await tx.insert(tagPeople).values(row).onDuplicateKeyUpdate({ set: row });
      await tx.delete(tagAvatarCandidates).where(eq(tagAvatarCandidates.tag, tag));
      if (rows.length) await tx.insert(tagAvatarCandidates).values(rows);
    });
    return { tag, qid: person?.qid ?? null, status, note, kept: rows.length };
  };
  if (!person) return save('none', null, []);

  const files = await candidateFiles(person);
  const seen: Seen[] = [];
  for (const info of await fileInfo(files)) {
    try {
      const bytes = await download(info.thumbUrl);
      const img = await decode(bytes);
      const insp = await inspect(img);
      seen.push({ info, bytes, img, verdict: insp.verdict, insp });
    } catch (err) {
      log({ tag, file: info.file, err: String(err) }, 'avatar photo skipped');
    }
  }
  const ref = await reference(seen);
  const tally: Record<string, number> = {};
  const passing: (Seen & { score: number; parts: Record<string, number> })[] = [];
  for (const s of seen) {
    const e = s.insp.embedding;
    if (e && (!ref || !sameFace(ref, e))) s.verdict = 'other';
    tally[s.verdict] = (tally[s.verdict] ?? 0) + 1;
    if ((s.verdict === 'ok' || s.verdict === 'bystander') && s.insp.main && s.insp.aligned && ref && e) {
      const { score, parts } = quality(s.insp.main, s.insp.aligned, cosine(ref, e), s.verdict);
      passing.push({ ...s, score, parts });
    }
  }
  passing.sort((a, b) => b.score - a.score);
  const kept: typeof passing = [];
  for (const p of passing) {
    if (kept.length >= KEEP) break;
    let dupe = kept.some((k) => shotName(k.info.file) === shotName(p.info.file));
    for (const k of kept) if (!dupe && (await sameShot(p.insp.aligned as Rgb, k.insp.aligned as Rgb))) dupe = true;
    if (!dupe) kept.push(p);
  }
  const summary = Object.entries(tally)
    .map(([k, v]) => `${k} ${v}`)
    .join('、');
  log({ tag, qid: person.qid, photos: seen.length, tally }, 'avatar candidates');
  if (!kept.length) return save('nophoto', `候選 ${seen.length} 張：${summary}`.slice(0, 120), []);
  const rows = [];
  for (const [i, k] of kept.entries()) {
    rows.push({
      tag,
      rank: i + 1,
      file: k.info.file.slice(0, 255),
      pageUrl: k.info.pageUrl.slice(0, 512),
      license: k.info.license,
      licenseUrl: k.info.licenseUrl,
      artist: k.info.artist,
      score: k.score,
      scores: k.parts,
      verdict: k.verdict,
      image: await renderAvatar(k.img, k.insp.main as NonNullable<Seen['insp']['main']>),
    });
  }
  const best = kept[0].score;
  if (best < LOW) return save('review', `最高分 ${best.toFixed(2)}`, rows);
  if (person.namesakes) return save('review', `同名 ${person.namesakes + 1} 人，用條目最多的`, rows);
  return save('auto', null, rows);
}

/** The most-tagged tags of the last `days` days not checked in the last 30 (all of them with `force`). */
export async function busyTags(db: Db, { limit = 100, days = 7, force = false } = {}) {
  const since = new Date(Date.now() - days * 86_400_000);
  const top = await db
    .select({ tag: articleTags.tag, n: count() })
    .from(articleTags)
    .where(gte(articleTags.publishedAt, since))
    .groupBy(articleTags.tag)
    .orderBy(desc(count()))
    .limit(limit * 3);
  if (force) return top.slice(0, limit).map((t) => t.tag);
  const fresh = new Set(
    (
      await db
        .select({ tag: tagPeople.tag })
        .from(tagPeople)
        .where(
          and(
            inArray(
              tagPeople.tag,
              top.map((t) => t.tag),
            ),
            gte(tagPeople.checkedAt, sql`NOW() - INTERVAL ${RECHECK_DAYS} DAY`),
          ),
        )
    ).map((r) => r.tag),
  );
  return top
    .map((t) => t.tag)
    .filter((t) => !fresh.has(t))
    .slice(0, limit);
}
