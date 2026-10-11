import { and, desc, eq, gte, max } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { type TagPersonStatus, tagAvatarCandidates, tagPeople, tagPeopleLog, tagStats } from '../db/schema.ts';
import { selectDiscoveryEntries } from '../v1/ranking-discovery.ts';
import { loadRanking } from '../v1/routes.ts';
import { inspect, quality, renderAvatar, sameFace, sameShot, type Verdict } from './portrait.ts';
import { alignFace, cosine, decode, embed, type Rgb } from './vision.ts';
import { candidateFiles, download, type FileInfo, fileInfo, findPerson } from './wikidata.ts';

// One person tag → Wikidata person → best Commons photos → sketch avatars
// (docs/tag-avatars.md). Every photo that passes is scored; the best is
// shown and the next two are kept so an admin can switch.

const KEEP = 3;
const LOW = 0.55; // best score under this → review
const RECHECK_DAYS = 30;
// The home page cloud shows the top 30 rising tags; a margin for the next hours.
const RISING = 60;

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
  // Decoded photos are ~6 MB each: kept only for the first (the reference
  // faces) and for photos that may be rendered.
  img: Rgb | null;
  verdict: Verdict | 'other';
  insp: Awaited<ReturnType<typeof inspect>>;
};

/** Embeddings of up to four faces in the first photo; the one most other photos agree with is the person. */
async function reference(seen: Seen[]) {
  const mains = seen.slice(1).flatMap((s) => (s.insp.embedding ? [s.insp.embedding] : []));
  const [first] = seen;
  const options = first?.insp.faces.length
    ? await Promise.all(first.insp.faces.slice(0, 4).map((f) => embed(alignFace(first.img as Rgb, f))))
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
  const save = async (status: TagPersonStatus, note: string | null, rows: (typeof tagAvatarCandidates.$inferInsert)[], show = true) => {
    const row = {
      tag,
      wikidataId: person?.qid ?? null,
      label: person?.label?.slice(0, 120) ?? null,
      description: person?.description?.slice(0, 255) ?? null,
      facts: person?.facts ?? null,
      status,
      note,
      shownRank: rows.length && show ? 1 : null,
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
      const keep = !seen.length || insp.verdict === 'ok' || insp.verdict === 'bystander';
      seen.push({ info, img: keep ? img : null, verdict: insp.verdict, insp });
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
      image: await renderAvatar(k.img as Rgb, k.insp.main as NonNullable<Seen['insp']['main']>),
    });
  }
  const best = kept[0].score;
  // 「天氣」 is a nickname of an idol, 「中秋」 a Song official's courtesy name:
  // an alias-only match waits for an admin before anything is shown.
  if (person.aliasOnly) return save('review', '只符合別名，選定後才顯示', rows, false);
  if (best < LOW) return save('review', `最高分 ${best.toFixed(2)}`, rows);
  if (person.namesakes) return save('review', `同名 ${person.namesakes + 1} 人，用條目最多的`, rows);
  return save('auto', null, rows);
}

/** The home page cloud's top rising tags (it shows 30), with a margin for the next hours. */
export const risingTags = (db: Db, limit = RISING) =>
  loadRanking(db, 'all')
    .then((r) =>
      selectDiscoveryEntries(r?.entries ?? [], 'growth', 'all')
        .slice(0, limit)
        .map((e) => e.tag),
    )
    .catch(() => [] as string[]);

/** Why an uploaded photo was turned down, in the admin's words. */
export const PHOTO_REJECTED: Partial<Record<Verdict, string>> = {
  noface: '照片裡找不到臉',
  small: '臉太小（裁切後臉寬要至少 80px，請用比較近的照片）',
  group: '照片裡有兩張差不多大的臉，請用只有這個人的照片',
};

/**
 * An admin's own photo of a person tag, for people Commons has no usable
 * photo of (docs/tag-avatars.md): the same face checks and sketch as a
 * Commons photo, minus the identity check (the admin chose the person). It
 * becomes the next candidate and is shown at once, as if chosen.
 */
export async function addPhoto(db: Db, tag: string, photo: Uint8Array, email: string) {
  const [person] = await db.select({ shownRank: tagPeople.shownRank }).from(tagPeople).where(eq(tagPeople.tag, tag));
  if (!person) return { tag, error: '這個標籤還沒比對到人物' };
  const img = await decode(photo);
  const insp = await inspect(img);
  if (insp.verdict !== 'ok' && insp.verdict !== 'bystander') return { tag, error: PHOTO_REJECTED[insp.verdict] ?? insp.verdict };
  const main = insp.main as NonNullable<typeof insp.main>;
  const { score, parts } = quality(main, insp.aligned as Rgb, 1, insp.verdict);
  const image = await renderAvatar(img, main);
  const [{ top }] = await db
    .select({ top: max(tagAvatarCandidates.rank) })
    .from(tagAvatarCandidates)
    .where(eq(tagAvatarCandidates.tag, tag));
  const rank = (top ?? 0) + 1;
  const at = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(tagAvatarCandidates).values({
      tag,
      rank,
      file: '管理員上傳',
      pageUrl: '',
      license: null,
      licenseUrl: null,
      artist: null,
      score,
      scores: parts,
      verdict: insp.verdict,
      image,
    });
    await tx
      .update(tagPeople)
      .set({ status: 'chosen', shownRank: rank, note: null, reviewedBy: email, reviewedAt: at })
      .where(eq(tagPeople.tag, tag));
    await tx.insert(tagPeopleLog).values({ tag, action: 'show', fromRank: person.shownRank, toRank: rank, email, at });
  });
  return { tag, rank, score, verdict: insp.verdict };
}

/**
 * The home page cloud's top rising tags, then tags that made the news ranking
 * in the last `days` days (tag_stats level 3: several outlets repeating it),
 * most hours first, minus those checked in the last 30 days (all of them with
 * `force`); with `risingOnly`, just the cloud's tags. tag_stats is small and indexed; grouping article_tags over a week
 * took minutes on production.
 */
export async function busyTags(db: Db, { limit = 100, days = 7, force = false, risingOnly = false } = {}) {
  const since = new Date(Date.now() - days * 86_400_000);
  // The home page cloud's rising tags first (its faces come from here).
  const rising = await risingTags(db);
  // The hourly run: only the cloud's words, so new faces show within the hour.
  const ranked = risingOnly
    ? []
    : await db
        .select({ tag: tagStats.tag })
        .from(tagStats)
        .where(and(eq(tagStats.category, 'news'), eq(tagStats.level, 3), gte(tagStats.lastHour, since)))
        .orderBy(desc(tagStats.hoursCount))
        .limit(5000);
  const fresh = force
    ? new Set<string>()
    : new Set(
        (
          await db
            .select({ tag: tagPeople.tag })
            .from(tagPeople)
            .where(gte(tagPeople.checkedAt, new Date(Date.now() - RECHECK_DAYS * 86_400_000)))
        ).map((r) => r.tag),
      );
  return [...new Set([...rising, ...ranked.map((r) => r.tag)])].filter((t) => !fresh.has(t)).slice(0, limit);
}
