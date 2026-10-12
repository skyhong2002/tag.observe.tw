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
import { approvePicture, pictureSubmissionKey, submitPicture } from '../src/pictures/submissions.ts';
import { uploadsToday } from '../src/pictures/votes.ts';

it('separates image fingerprints by exact tag and picture kind', () => {
  const image = Buffer.from('processed webp');
  expect(pictureSubmissionKey('AI', 'visual', image)).toBe(pictureSubmissionKey('AI', 'visual', image));
  expect(pictureSubmissionKey('AI', 'visual', image)).not.toBe(pictureSubmissionKey('ai', 'visual', image));
  expect(pictureSubmissionKey('AI', 'visual', image)).not.toBe(pictureSubmissionKey('AI', 'avatar', image));
});

const url = process.env.TEST_DB_URL;
describe.skipIf(!url)('private picture submission queue (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  const app = Fastify();
  const origin = 'https://tag.observe.tw';
  const user = { id: 601, email: 'picture-fixture@example.test', name: null, picture: null, role: 'reader' as const };
  let image: Buffer;
  const approve = async (id: number) =>
    db.transaction(async (tx) => {
      const [row] = await tx.select().from(tagSubmissions).where(eq(tagSubmissions.id, id)).for('update');
      const approved = await approvePicture(tx as unknown as Db, row);
      await tx
        .update(tagSubmissions)
        .set({ status: 'approved', candidateRank: approved.rank, reviewedBy: 602, reviewedAt: new Date() })
        .where(eq(tagSubmissions.id, id));
      return approved;
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
  it('keeps a processed upload private and unvotable until review, including deduplication', async () => {
    const response = await upload({ origin, 'x-user': 'reader' });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ kind: 'visual', status: 'pending' });
    submissionId = response.json().submissionId;
    expect(response.headers['cache-control']).toBe('no-store');
    expect(await db.select().from(tagVisualCandidates)).toHaveLength(0);
    expect(await db.select().from(tagVisuals)).toHaveLength(0);
    expect(await db.select().from(tagPictureVotes)).toHaveLength(0);
    expect((await app.inject({ url: '/auth/pictures/F1-test', headers: { 'x-user': 'reader' } })).json().candidates).toEqual([]);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/auth/pictures/F1-test/vote',
          headers: { origin, 'x-user': 'reader' },
          payload: { rank: 1 },
        })
      ).statusCode,
    ).toBe(404);
    expect((await upload({ origin, 'x-user': 'reader' })).json().submissionId).toBe(submissionId);
    expect(await db.select().from(tagSubmissions)).toHaveLength(1);
    expect(await db.select().from(tagSubmissionLog)).toHaveLength(1);
    expect(await uploadsToday(db, user.id)).toBe(1);
  });
  it('approval enables the existing vote mechanism and counts the upload only once', async () => {
    expect(await approve(submissionId)).toEqual({ rank: 1, shownRank: 1 });
    expect(await db.select().from(tagVisualCandidates)).toMatchObject([{ uploadedBy: user.id, rank: 1 }]);
    expect(await db.select().from(tagVisuals)).toMatchObject([{ status: 'voted', shownRank: 1 }]);
    expect(await uploadsToday(db, user.id)).toBe(1);
    await expect(approve(submissionId)).rejects.toThrow('已經審核');
  });
  it('preserves rejection across a duplicate upload from another reader', async () => {
    const input = { tag: 'F1-rejected', pictureKind: 'visual' as const, image, userId: user.id };
    const result = await submitPicture(db, input);
    await db.update(tagSubmissions).set({ status: 'rejected' }).where(eq(tagSubmissions.id, result.submissionId));
    expect(await submitPicture(db, { ...input, userId: 602 })).toMatchObject({ submissionId: result.submissionId, status: 'rejected' });
    expect(await db.select().from(tagVisualCandidates).where(eq(tagVisualCandidates.tag, input.tag))).toHaveLength(0);
  });
  it('keeps administrator picture locks when an uploaded candidate is approved', async () => {
    await db.insert(tagVisuals).values({ tag: 'F1-locked', status: 'hidden', checkedAt: new Date() });
    const result = await submitPicture(db, { tag: 'F1-locked', pictureKind: 'visual', image, userId: user.id });
    await approve(result.submissionId);
    expect(await db.select().from(tagVisuals).where(eq(tagVisuals.tag, 'F1-locked'))).toMatchObject([
      { status: 'hidden', shownRank: null },
    ]);
  });
  it('preserves avatar quality and rejects a portrait after a non-person correction', async () => {
    await db.insert(tagPeople).values({ tag: 'F1-person', wikidataId: 'Q42', status: 'auto', checkedAt: new Date() });
    const meta = { score: 0.9, scores: { face: 0.9 }, verdict: 'ok' };
    const result = await submitPicture(db, { tag: 'F1-person', pictureKind: 'avatar', image, userId: user.id, pictureMeta: meta });
    expect(await db.select().from(tagAvatarCandidates)).toHaveLength(0);
    await db.update(tagPeople).set({ status: 'nonhuman', wikidataId: null }).where(eq(tagPeople.tag, 'F1-person'));
    await expect(approve(result.submissionId)).rejects.toThrow('非人物');
    await db.update(tagPeople).set({ status: 'auto', wikidataId: 'Q42' }).where(eq(tagPeople.tag, 'F1-person'));
    await approve(result.submissionId);
    expect(await db.select().from(tagAvatarCandidates)).toMatchObject([
      { score: 0.9, scores: meta.scores, verdict: 'ok', uploadedBy: user.id },
    ]);
  });
  it('serialises concurrent approvals for the same tag and preserves cross-reader deduplication', async () => {
    const input = { tag: 'F1-concurrent', pictureKind: 'visual' as const, image, userId: user.id };
    const duplicates = await Promise.all([submitPicture(db, input), submitPicture(db, { ...input, userId: 602 })]);
    expect(duplicates[0].submissionId).toBe(duplicates[1].submissionId);
    const other = await submitPicture(db, { ...input, image: Buffer.from('another processed image') });
    const ranks = await Promise.all([approve(duplicates[0].submissionId), approve(other.submissionId)]);
    expect(ranks.map((r) => r.rank).sort()).toEqual([1, 2]);
    expect(await db.select().from(tagVisualCandidates).where(eq(tagVisualCandidates.tag, input.tag))).toHaveLength(2);
    const submissionLogs = await db.select().from(tagSubmissionLog).where(eq(tagSubmissionLog.submissionId, duplicates[0].submissionId));
    expect(submissionLogs).toHaveLength(1);
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
