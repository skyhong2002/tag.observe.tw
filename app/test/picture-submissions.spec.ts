import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import Fastify from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/client.ts';
import {
  tagAvatarCandidates,
  tagPeople,
  tagPictureVotes,
  tagSubmissionLog,
  tagSubmissions,
  tagVisualCandidates,
  tagVisuals,
  users,
} from '../src/db/schema.ts';
import { registerPictureRoutes } from '../src/pictures/routes.ts';
import { pictureSubmissionKey, revokePicture, submitPicture } from '../src/pictures/submissions.ts';
import { castVote, uploadsToday } from '../src/pictures/votes.ts';

it('separates image fingerprints by exact tag and picture kind', () => {
  const image = Buffer.from('processed webp');
  expect(pictureSubmissionKey('AI', 'visual', image)).toBe(pictureSubmissionKey('AI', 'visual', image));
  expect(pictureSubmissionKey('AI', 'visual', image)).not.toBe(pictureSubmissionKey('ai', 'visual', image));
  expect(pictureSubmissionKey('AI', 'visual', image)).not.toBe(pictureSubmissionKey('AI', 'avatar', image));
});

const url = process.env.TEST_DB_URL;
describe.skipIf(!url)('reader picture submissions, public on arrival (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  const app = Fastify();
  const origin = 'https://tag.observe.tw';
  const user = { id: 601, email: 'picture-fixture@example.test', name: null, picture: null, role: 'reader' as const };
  let image: Buffer;
  const revoke = async (id: number) =>
    db.transaction(async (tx) => {
      const [row] = await tx.select().from(tagSubmissions).where(eq(tagSubmissions.id, id)).for('update');
      await revokePicture(tx as unknown as Db, row);
      await tx.update(tagSubmissions).set({ status: 'revoked', reviewedBy: 602, reviewedAt: new Date() }).where(eq(tagSubmissions.id, id));
    });
  beforeAll(async () => {
    if (new URL(url!).pathname === '/tag_observe') throw Error('Refusing production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const table of [
      'tag_submissions',
      'tag_submission_log',
      'tag_visual_candidates',
      'tag_visuals',
      'tag_avatar_candidates',
      'tag_people',
      'tag_picture_votes',
      'users',
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    for (const id of [601, 602])
      await db
        .insert(users)
        .values({ id, googleSub: `fixture-${id}`, email: `${id}@example.test`, createdAt: new Date(), lastLoginAt: new Date() });
    image = await sharp(Buffer.from('<svg width="80" height="80"><path fill="red" d="M10 10h60v20H50v40H30V30H10z"/></svg>'))
      .png()
      .toBuffer();
    registerPictureRoutes(app, db, {
      currentUser: async (request) => (request.headers['x-user'] ? user : null),
      origin,
      queue: () => ({ add: async () => ({ id: 'unused' }), getJob: async () => null, getJobs: async () => [] }),
    });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await close?.();
  });
  const upload = (headers: Record<string, string>, agree = true) =>
    app.inject({
      method: 'POST',
      url: '/auth/pictures/F1-test/upload',
      headers,
      payload: { image: image.toString('base64'), agree },
    });
  it('requires login, same Origin and the existing rights confirmation', async () => {
    expect((await upload({ origin })).statusCode).toBe(401);
    expect((await upload({ origin: 'https://other.example', 'x-user': 'reader' })).statusCode).toBe(403);
    expect((await upload({ origin, 'x-user': 'reader' }, false)).statusCode).toBe(400);
    expect(await db.select().from(tagSubmissions)).toHaveLength(0);
  });
  let submissionId: number;
  it('makes a processed upload a public candidate at once; other readers decide whether it shows', async () => {
    const response = await upload({ origin, 'x-user': 'reader' });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ kind: 'visual', status: 'approved' });
    submissionId = response.json().submissionId;
    expect(response.headers['cache-control']).toBe('no-store');
    expect(await db.select().from(tagVisualCandidates)).toMatchObject([{ uploadedBy: user.id, rank: 1, note: '讀者上傳' }]);
    // No vote comes with an upload, so nothing is shown yet.
    expect(await db.select().from(tagVisuals)).toMatchObject([{ status: 'none', shownRank: null }]);
    expect(await db.select().from(tagPictureVotes)).toHaveLength(0);
    expect((await app.inject({ url: '/auth/pictures/F1-test', headers: { 'x-user': 'reader' } })).json().candidates).toHaveLength(1);
    // The uploader cannot vote their own picture up.
    const own = await app.inject({
      method: 'PUT',
      url: '/auth/pictures/F1-test/vote',
      headers: { origin, 'x-user': 'reader' },
      payload: { rank: 1 },
    });
    expect(own.statusCode).toBe(403);
    expect(own.json().error).toContain('自己上傳');
    expect(await castVote(db, 'F1-test', 'visual', 602, 1)).toBe(1);
    expect(await db.select().from(tagVisuals)).toMatchObject([{ status: 'voted', shownRank: 1 }]);
    expect((await upload({ origin, 'x-user': 'reader' })).json().submissionId).toBe(submissionId);
    expect(await db.select().from(tagSubmissions)).toMatchObject([{ status: 'approved', candidateRank: 1 }]);
    expect((await db.select().from(tagSubmissionLog)).map((l) => l.action)).toEqual(['submit', 'auto-approved']);
    expect(await uploadsToday(db, user.id)).toBe(1);
  });
  it('revoking takes the upload down and restores what the tag showed before', async () => {
    await db.insert(tagVisuals).values({ tag: 'F1-restore', status: 'auto', shownRank: 1, kind: 'logo', checkedAt: new Date() });
    await db.insert(tagVisualCandidates).values({ tag: 'F1-restore', rank: 1, kind: 'logo', note: 'AI' });
    const result = await submitPicture(db, { tag: 'F1-restore', pictureKind: 'visual', image, userId: user.id });
    expect(await db.select().from(tagVisuals).where(eq(tagVisuals.tag, 'F1-restore'))).toMatchObject([{ status: 'auto', shownRank: 1 }]);
    await castVote(db, 'F1-restore', 'visual', 602, 2);
    expect(await db.select().from(tagVisuals).where(eq(tagVisuals.tag, 'F1-restore'))).toMatchObject([{ status: 'voted', shownRank: 2 }]);
    await revoke(result.submissionId);
    expect(await db.select().from(tagVisuals).where(eq(tagVisuals.tag, 'F1-restore'))).toMatchObject([{ status: 'auto', shownRank: 1 }]);
    expect(await db.select().from(tagVisualCandidates).where(eq(tagVisualCandidates.tag, 'F1-restore'))).toMatchObject([{ rank: 1 }]);
    expect(await db.select().from(tagPictureVotes).where(eq(tagPictureVotes.tag, 'F1-restore'))).toHaveLength(0);
    // A revoked picture stays down when another reader uploads the same file.
    expect(await submitPicture(db, { tag: 'F1-restore', pictureKind: 'visual', image, userId: 602 })).toMatchObject({
      submissionId: result.submissionId,
      status: 'revoked',
    });
    expect(await db.select().from(tagVisualCandidates).where(eq(tagVisualCandidates.tag, 'F1-restore'))).toHaveLength(1);
  });
  it('revokes an older approval without a snapshot by showing the best remaining candidate', async () => {
    await db.insert(tagVisuals).values({ tag: 'F1-legacy', status: 'voted', shownRank: 2, kind: 'logo', checkedAt: new Date() });
    await db.insert(tagVisualCandidates).values([
      { tag: 'F1-legacy', rank: 1, kind: 'logo', note: 'Wikidata' },
      { tag: 'F1-legacy', rank: 2, kind: 'logo', note: '讀者上傳（已審核）', image, uploadedBy: user.id, uploadedAt: new Date() },
    ]);
    const [legacy] = await db
      .insert(tagSubmissions)
      .values({
        kind: 'picture',
        tag: 'F1-legacy',
        source: 'submission',
        status: 'approved',
        createdBy: user.id,
        createdAt: new Date(),
        dedupeKey: 'legacy-approved-without-snapshot',
        pictureKind: 'visual',
        image,
        rightsConfirmed: true,
        candidateRank: 2,
      })
      .$returningId();
    await revoke(legacy.id);
    expect(await db.select().from(tagVisuals).where(eq(tagVisuals.tag, 'F1-legacy'))).toMatchObject([{ status: 'auto', shownRank: 1 }]);
  });
  it('keeps administrator picture locks when an upload is published', async () => {
    await db.insert(tagVisuals).values({ tag: 'F1-locked', status: 'hidden', checkedAt: new Date() });
    await submitPicture(db, { tag: 'F1-locked', pictureKind: 'visual', image, userId: user.id });
    expect(await db.select().from(tagVisuals).where(eq(tagVisuals.tag, 'F1-locked'))).toMatchObject([
      { status: 'hidden', shownRank: null },
    ]);
  });
  it('publishes a portrait with its quality and refuses one after a non-person correction', async () => {
    await db.insert(tagPeople).values({ tag: 'F1-person', wikidataId: 'Q42', status: 'auto', checkedAt: new Date() });
    const meta = { score: 0.9, scores: { face: 0.9 }, verdict: 'ok' };
    const result = await submitPicture(db, { tag: 'F1-person', pictureKind: 'avatar', image, userId: user.id, pictureMeta: meta });
    expect(await db.select().from(tagAvatarCandidates)).toMatchObject([
      { score: 0.9, scores: meta.scores, verdict: 'ok', uploadedBy: user.id },
    ]);
    expect(await db.select().from(tagPeople).where(eq(tagPeople.tag, 'F1-person'))).toMatchObject([{ status: 'auto', shownRank: null }]);
    await castVote(db, 'F1-person', 'avatar', 602, 1);
    expect(await db.select().from(tagPeople).where(eq(tagPeople.tag, 'F1-person'))).toMatchObject([{ status: 'voted', shownRank: 1 }]);
    await revoke(result.submissionId);
    expect(await db.select().from(tagPeople).where(eq(tagPeople.tag, 'F1-person'))).toMatchObject([{ status: 'auto', shownRank: null }]);
    expect(await db.select().from(tagAvatarCandidates)).toHaveLength(0);
    await db.update(tagPeople).set({ status: 'nonhuman', wikidataId: null }).where(eq(tagPeople.tag, 'F1-person'));
    await expect(
      submitPicture(db, { tag: 'F1-person', pictureKind: 'avatar', image: Buffer.from('other'), userId: user.id, pictureMeta: meta }),
    ).rejects.toThrow('非人物');
  });
  it('serialises concurrent uploads for the same tag and deduplicates across readers', async () => {
    const input = { tag: 'F1-concurrent', pictureKind: 'visual' as const, image, userId: user.id };
    const duplicates = await Promise.all([submitPicture(db, input), submitPicture(db, { ...input, userId: 602 })]);
    expect(duplicates[0].submissionId).toBe(duplicates[1].submissionId);
    await submitPicture(db, { ...input, image: Buffer.from('another processed image') });
    const ranks = (await db.select().from(tagVisualCandidates).where(eq(tagVisualCandidates.tag, input.tag))).map((c) => c.rank).sort();
    expect(ranks).toEqual([1, 2]);
    const submissionLogs = await db.select().from(tagSubmissionLog).where(eq(tagSubmissionLog.submissionId, duplicates[0].submissionId));
    expect(submissionLogs.map((l) => l.action)).toEqual(['submit', 'auto-approved']);
  });

  it('enforces the daily quota for pending and rejected submissions', async () => {
    const used = await uploadsToday(db, user.id);
    for (let i = used; i < 20; i++) await submitPicture(db, { tag: `F1-quota-${i}`, pictureKind: 'visual', image, userId: user.id });
    expect(await uploadsToday(db, user.id)).toBe(20);
    await expect(submitPicture(db, { tag: 'F1-over-quota', pictureKind: 'visual', image, userId: user.id })).rejects.toThrow('20');
    expect((await upload({ origin, 'x-user': 'reader' })).statusCode).toBe(429);
    expect(
      await db
        .select()
        .from(tagSubmissions)
        .where(and(eq(tagSubmissions.tag, 'F1-over-quota'), eq(tagSubmissions.createdBy, user.id))),
    ).toHaveLength(0);
  });
});
