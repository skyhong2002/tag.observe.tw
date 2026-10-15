// All identities and data in this suite exist only in an explicitly selected fixture database.
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { createDb, type Db } from '../src/db/client.ts';
import {
  articleTags,
  tagGroupDefs,
  tagGroupMemberLog,
  tagGroupMembers,
  tagRelationLock,
  tagSubmissionLog,
  tagSubmissions,
  users,
  writingPeople,
} from '../src/db/schema.ts';
import { submitPicture } from '../src/pictures/submissions.ts';
import { relationKey, tagId, validSemanticTag } from '../src/tag-groups/semantic.ts';

const origin = 'https://tag.observe.tw';
const url = process.env.TEST_DB_URL;
const actors = {
  reader: { id: 701, sub: 'fixture-reader', email: 'reader@fixture.test', name: 'Private Reader', picture: null },
  other: { id: 702, sub: 'fixture-other', email: 'other@fixture.test', name: 'Private Other', picture: null },
  admin: { id: 703, sub: 'fixture-admin', email: 'admin@fixture.test', name: 'Private Admin', picture: null },
};
type Actor = keyof typeof actors;
const headers = (actor: Actor = 'reader') => ({ cookie: `tag_session=${actor}`, origin });

describe('semantic identity and validation', () => {
  it('keeps exact stable labels and makes only alias/related symmetric', () => {
    expect(tagId('AI')).not.toBe(tagId('ai'));
    expect(relationKey('甲', 'related', '乙')).toBe(relationKey('乙', 'related', '甲'));
    expect(relationKey('甲', 'alias', '乙')).toBe(relationKey('乙', 'alias', '甲'));
    expect(relationKey('甲', 'is-a', '乙')).not.toBe(relationKey('乙', 'is-a', '甲'));
  });
  it('rejects control characters, blank or oversized labels without corrupting supplementary Unicode', () => {
    for (const value of ['', ' 前空白', '後空白 ', '\u0003比基尼', '\b', '\ud800', '字'.repeat(61), null])
      expect(validSemanticTag(value)).toBe(false);
    expect(validSemanticTag('𠀀'.repeat(60))).toBe(true);
  });
  it('does not merge a stable group ID with a valid label resembling that ID', () => {
    expect(relationKey('甲', 'is-a', { groupId: 811 })).not.toBe(relationKey('甲', 'is-a', 'group:811'));
    expect(relationKey('甲', 'is-a', { groupId: 811 })).not.toBe(relationKey('甲', 'is-a', '811'));
    expect(relationKey('甲', 'is-a', { groupId: 811 })).not.toBe(relationKey('甲', 'is-a', { groupId: 812 }));
  });
});

describe.skipIf(!url)('tag semantic submission boundaries (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const submit = (tag: string, target: string, type = 'related', actor: Actor = 'reader') =>
    app.inject({
      method: 'POST',
      url: `/auth/tags/${encodeURIComponent(tag)}/relations`,
      headers: headers(actor),
      payload: { type, target, reason: '私人投稿理由，只供審核。' },
    });
  const review = (id: number, status = 'approved', actor: Actor = 'admin') =>
    app.inject({
      method: 'PUT',
      url: `/auth/admin/tag-submissions/${id}`,
      headers: headers(actor),
      payload: { status, reason: '私人審核意見。' },
    });
  const publicRead = (tag: string, h: Record<string, string> = {}) =>
    app.inject({ url: `/api/v1/tags/${encodeURIComponent(tag)}/relations`, headers: h });
  const vote = (tag: string, key: string, value: number, actor: Actor = 'other') =>
    app.inject({
      method: 'PUT',
      url: `/auth/tags/${encodeURIComponent(tag)}/relations/vote`,
      headers: headers(actor),
      payload: { key, value },
    });
  type Candidate = { key: string; target: string; status: string; origin: string; agree: number; disagree: number; mine: boolean };
  const candidates = async (tag: string, actor?: Actor) =>
    (await app.inject({ url: `/auth/tags/${encodeURIComponent(tag)}/relations/candidates`, headers: actor ? headers(actor) : {} })).json()
      .candidates as Candidate[];
  const keyOf = async (id: number) => (await db.select().from(tagSubmissions).where(eq(tagSubmissions.id, id)))[0].dedupeKey;
  // Proposals wait for votes; one other reader's agreement establishes them (owner's decision, 2026-10-15).
  const approved = async (tag: string, target: string, type = 'is-a') => {
    const proposed = await submit(tag, target, type);
    expect(proposed.statusCode, proposed.body).toBe(201);
    expect(proposed.json().status).toBe('pending');
    const id = proposed.json().id as number;
    const voted = await vote(tag, await keyOf(id), 1);
    expect(voted.statusCode, voted.body).toBe(200);
    expect((await db.select().from(tagSubmissions).where(eq(tagSubmissions.id, id)))[0].status).toBe('approved');
    return id;
  };
  beforeAll(async () => {
    const fixture = new URL(url!);
    if (fixture.hostname !== '127.0.0.1' || fixture.port !== '18306' || fixture.pathname !== '/tag_f1_semantic_test')
      throw Error('This suite requires the isolated tag_f1_semantic_test database on 127.0.0.1:18306');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const table of ['users', 'tag_group_defs', 'tag_group_members']) await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    await db.insert(users).values(
      Object.values(actors).map((a) => ({
        id: a.id,
        googleSub: a.sub,
        email: a.email,
        name: a.name,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      })),
    );
    const unsupported = async (): Promise<never> => {
      throw Error('Unexpected authentication mutation in read-only fixture store');
    };
    const store = {
      upsertUser: unsupported,
      createSession: unsupported,
      deleteSession: unsupported,
      listUsers: unsupported,
      setAdmin: unsupported,
      sessionUser: async (hash: string) => Object.entries(actors).find(([token]) => hashToken(token) === hash)?.[1] ?? null,
    } satisfies LoginStore;
    app = await buildApp(
      {
        uiOrigin: 'http://127.0.0.1:9',
        login: { clientId: 'fixture', clientSecret: 'fixture', origin, admins: new Set([actors.admin.email]) },
      },
      {
        db,
        loginStore: store,
        jobQueue: () => ({ add: async () => ({ id: 'fixture-job' }), getJob: async () => null, getJobs: async () => [] }),
      },
    );
  });
  beforeEach(async () => {
    for (const table of [
      'tag_submissions',
      'tag_submission_log',
      'tag_group_defs',
      'tag_group_members',
      'tag_group_member_log',
      'writing_people',
      'tag_visuals',
      'tag_visual_candidates',
      'tag_picture_votes',
      'tag_relation_votes',
    ])
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
  });
  afterAll(async () => {
    await app?.close();
    await close?.();
  });

  it('requires login and exact same-origin writes, including administrator reviews', async () => {
    const path = '/auth/tags/甲/relations';
    for (const [h, status] of [
      [{ origin }, 401],
      [{ cookie: 'tag_session=reader', origin: 'https://evil.test' }, 403],
      [{ cookie: 'tag_session=reader' }, 403],
    ] as const) {
      const response = await app.inject({
        method: 'POST',
        url: path,
        headers: h,
        payload: { type: 'related', target: '乙', reason: '理由' },
      });
      expect(response.statusCode).toBe(status);
      expect(response.headers['cache-control']).toContain('no-store');
    }
    const row = await submit('甲', '乙');
    expect((await review(row.json().id, 'revoked', 'reader')).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/auth/admin/tag-submissions/${row.json().id}`,
          headers: { cookie: 'tag_session=admin', origin: 'https://evil.test' },
          payload: { status: 'revoked', reason: '理由' },
        })
      ).statusCode,
    ).toBe(403);
    expect((await app.inject('/auth/admin/tag-submissions')).statusCode).toBe(401);
    expect((await app.inject({ url: '/auth/admin/tag-submissions', headers: headers() })).statusCode).toBe(403);
  });
  it('validates self relations, types, controls and reason bounds', async () => {
    for (const [tag, target, type] of [
      ['甲', '甲', 'related'],
      ['甲', '乙', 'cooccur'],
      ['甲', '\u0003乙', 'is-a'],
      ['甲', '乙 ', 'alias'],
    ])
      expect((await submit(tag, target, type)).statusCode).toBe(400);
    const response = await app.inject({
      method: 'POST',
      url: '/auth/tags/甲/relations',
      headers: headers(),
      payload: { type: 'related', target: '乙', reason: 'x'.repeat(1001) },
    });
    expect(response.statusCode).toBe(400);
    // The reason is optional.
    const bare = await app.inject({
      method: 'POST',
      url: '/auth/tags/甲/relations',
      headers: headers(),
      payload: { type: 'related', target: '丙' },
    });
    expect(bare.statusCode).toBe(201);
    expect(await db.select({ reason: tagSubmissions.reason }).from(tagSubmissions)).toEqual([{ reason: null }]);
  });
  it('deduplicates symmetric submissions, including concurrent authors, and keeps a revocation', async () => {
    const both = await Promise.all([submit('甲', '乙', 'alias'), submit('乙', '甲', 'alias', 'other')]);
    expect(both.map((r) => r.statusCode).sort(), both.map((r) => r.body).join('\n')).toEqual([200, 201]);
    expect(both[0].json().id).toBe(both[1].json().id);
    expect(await db.select().from(tagSubmissions)).toHaveLength(1);
    expect((await db.select().from(tagSubmissionLog)).map((l) => l.action)).toEqual(['submit']);
    expect((await publicRead('甲')).json()).toMatchObject({ relations: [], voting: 1 });
    expect((await vote('甲', await keyOf(both[0].json().id), 1, 'admin')).statusCode).toBe(200);
    expect((await publicRead('甲')).json().relations).toHaveLength(1);
    expect((await review(both[0].json().id, 'revoked')).statusCode).toBe(200);
    const repeated = await submit('甲', '乙', 'alias');
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().status).toBe('revoked');
    expect((await publicRead('甲')).json().relations).toEqual([]);
  });
  it('publishes only approved edges, reverses symmetric lookup, and exposes no private audit fields', async () => {
    await approved('公開甲', '公開乙', 'related');
    expect((await review(await approved('公開甲', '撤下詞', 'related'), 'revoked')).statusCode).toBe(200);
    await submit('公開甲', '投票中詞');
    const result = await publicRead('公開甲');
    expect(result.json().relations).toHaveLength(1);
    expect(result.json().relations[0]).toMatchObject({
      type: 'related',
      target: { label: '公開乙', id: tagId('公開乙') },
      status: 'approved',
      source: 'submission',
    });
    expect((await publicRead('公開乙')).json().relations[0].target.label).toBe('公開甲');
    for (const sensitive of ['createdBy', 'reviewedBy', 'reason', 'email', '私人', 'Private', 'image', 'rightsConfirmed'])
      expect(result.body).not.toContain(sensitive);
  });
  it('isolates byte-exact labels under the database case-insensitive collation', async () => {
    await approved('F1-AI', '技術', 'related');
    await approved('F1-ai', '另一概念', 'related');
    expect((await publicRead('F1-AI')).json().relations.map((r: { target: { label: string } }) => r.target.label)).toEqual(['技術']);
    expect((await publicRead('F1-ai')).json().relations.map((r: { target: { label: string } }) => r.target.label)).toEqual(['另一概念']);
  });
  it('allows multiple parents and two classification levels while rejecting a back edge', async () => {
    await approved('人物甲', '醫事身分');
    await approved('人物甲', '公共身分');
    await approved('醫事身分', '專業身分');
    const result = (await publicRead('人物甲')).json();
    expect(
      result.relations
        .filter((r: { depth: number }) => r.depth === 1)
        .map((r: { target: { label: string } }) => r.target.label)
        .sort(),
    ).toEqual(['公共身分', '醫事身分']);
    expect((await publicRead('醫事身分')).json().relations.some((r: { target: { label: string } }) => r.target.label === '專業身分')).toBe(
      true,
    );
    expect(result.relations.find((r: { target: { label: string } }) => r.target.label === '專業身分')).toMatchObject({
      inherited: true,
      depth: 2,
    });
    const cycle = await submit('專業身分', '人物甲', 'is-a');
    expect(cycle.statusCode).toBe(201);
    expect((await vote('專業身分', await keyOf(cycle.json().id), 1)).statusCode).toBe(409);
    expect((await db.select().from(tagSubmissions).where(eq(tagSubmissions.id, cycle.json().id)))[0].status).toBe('pending');
  });
  it('projects existing multi-parent groups and ancestors without mislabelling topics or unreviewed membership', async () => {
    await db.insert(tagGroupDefs).values([
      { id: 801, label: '職業總類', kind: 'group', sort: 1, createdAt: new Date() },
      { id: 802, label: '醫師類', kind: 'group', parentId: 801, sort: 2, createdAt: new Date() },
      { id: 803, label: '政治人物類', kind: 'group', sort: 3, createdAt: new Date() },
      { id: 804, label: '選舉議題', kind: 'topic', sort: 4, createdAt: new Date() },
      { id: 805, label: '未審類', kind: 'group', sort: 5, createdAt: new Date() },
    ]);
    await db.insert(tagGroupMembers).values(
      [802, 803, 804, 805].map((id) => ({
        tag: '柯文哲fixture',
        groupId: id,
        source: 'admin' as const,
        status: id === 805 ? ('review' as const) : ('confirmed' as const),
        updatedAt: new Date(),
      })),
    );
    const data = (await publicRead('柯文哲fixture')).json();
    expect(data.relations).toHaveLength(3);
    expect(data.relations.find((r: { target: { label: string } }) => r.target.label === '職業總類')).toMatchObject({
      type: 'is-a',
      depth: 2,
      inherited: true,
      createdAt: null,
    });
  });
  it('reuses existing classification IDs, persists the original submission source and synchronizes writing roles', async () => {
    await db
      .insert(tagGroupDefs)
      .values({ id: 811, label: '既有政治分類', kind: 'group', writingRole: '公職政治', sort: 1, createdAt: new Date() });
    const submissionId = await approved('政治人物fixture', '既有政治分類');
    const [proposal] = await db.select().from(tagSubmissions).where(eq(tagSubmissions.id, submissionId));
    expect(proposal).toMatchObject({ targetGroupId: 811, source: 'submission' });
    expect(await db.select().from(tagGroupMembers)).toMatchObject([
      { tag: '政治人物fixture', groupId: 811, status: 'confirmed', reviewedBy: 'votes' },
    ]);
    expect(await db.select().from(tagGroupMemberLog)).toMatchObject([{ action: 'confirm', tag: '政治人物fixture', groupId: 811 }]);
    expect(await db.select().from(writingPeople).where(eq(writingPeople.name, '政治人物fixture'))).toMatchObject([
      { role: '公職政治', source: 'admin' },
    ]);
    const relations = (await publicRead('政治人物fixture')).json().relations;
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ target: { id: 'group:811', href: '/group/811/' }, source: 'submission', inherited: false });
    expect(relations[0].createdAt).not.toBeNull();
    expect((await submit('既有政治分類', '新分類', 'is-a')).statusCode).toBe(409);
    // Revoking returns the membership to what it was (here: none).
    expect((await review(submissionId, 'revoked')).statusCode).toBe(200);
    expect(await db.select().from(tagGroupMembers)).toHaveLength(0);
    expect((await db.select().from(tagGroupMemberLog)).map((l) => l.action)).toEqual(['confirm', 'revoke']);
    expect((await publicRead('政治人物fixture')).json().relations).toEqual([]);
  });
  it('restores an earlier membership status when its confirmation is revoked', async () => {
    await db.insert(tagGroupDefs).values({ id: 814, label: '待審分類', kind: 'group', sort: 1, createdAt: new Date() });
    await db.insert(tagGroupMembers).values({ tag: '既有成員', groupId: 814, source: 'ai', status: 'review', updatedAt: new Date() });
    const id = await approved('既有成員', '待審分類');
    expect(await db.select().from(tagGroupMembers)).toMatchObject([{ status: 'confirmed' }]);
    expect((await review(id, 'revoked')).statusCode).toBe(200);
    expect(await db.select().from(tagGroupMembers)).toMatchObject([{ tag: '既有成員', groupId: 814, status: 'review' }]);
  });
  it('does not resurrect revoked group membership through inherited classifications', async () => {
    await db.insert(tagGroupDefs).values({ id: 812, label: '可撤銷分類', kind: 'group', sort: 1, createdAt: new Date() });
    await approved('分類中介', '可撤銷分類');
    await approved('分類底層', '分類中介');
    expect((await publicRead('分類底層')).json().relations.some((r: { target: { id: string } }) => r.target.id === 'group:812')).toBe(true);
    await db.update(tagGroupMembers).set({ status: 'rejected' }).where(eq(tagGroupMembers.tag, '分類中介'));
    expect((await publicRead('分類中介')).json().relations).toEqual([]);
    expect((await publicRead('分類底層')).json().relations.some((r: { target: { id: string } }) => r.target.id === 'group:812')).toBe(
      false,
    );
  });
  it('still revokes a membership after its group was deleted', async () => {
    await db.insert(tagGroupDefs).values({ id: 813, label: '即將刪除分類', kind: 'group', sort: 1, createdAt: new Date() });
    const id = await approved('候選分類詞', '即將刪除分類');
    await db.update(tagGroupDefs).set({ deletedAt: new Date() }).where(eq(tagGroupDefs.id, 813));
    expect((await review(id, 'revoked')).statusCode).toBe(200);
    expect(await db.select().from(tagGroupMembers)).toHaveLength(0);
  });

  it('serializes opposite-edge votes so exactly one can close no cycle', async () => {
    const a = await submit('並行甲', '並行乙', 'is-a');
    const b = await submit('並行乙', '並行甲', 'is-a', 'other');
    const [ka, kb] = [await keyOf(a.json().id), await keyOf(b.json().id)];
    const responses = await Promise.all([vote('並行甲', ka, 1, 'admin'), vote('並行乙', kb, 1, 'admin')]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await db.select().from(tagSubmissions)).filter((r) => r.status === 'approved')).toHaveLength(1);
  });
  it('fails closed when the graph lock row is missing', async () => {
    await db.delete(tagRelationLock).where(eq(tagRelationLock.id, 1));
    try {
      const response = await submit('缺鎖甲', '缺鎖乙', 'is-a');
      expect(response.statusCode).toBe(409);
      expect(await db.select().from(tagSubmissions)).toHaveLength(0);
      expect(await db.select().from(tagSubmissionLog)).toHaveLength(0);
    } finally {
      await db.insert(tagRelationLock).ignore().values({ id: 1 });
    }
  });

  it('serializes two revocations of the same submission and keeps exactly one audit', async () => {
    const id = await approved('競爭甲', '競爭乙', 'related');
    const responses = await Promise.all([review(id, 'revoked'), review(id, 'revoked')]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await db.select().from(tagSubmissionLog)).map((l) => l.action)).toEqual(['submit', 'vote-approved', 'revoked']);
  });
  it('lets other readers decide: no self-vote, and disagreement or withdrawal sends it back to voting', async () => {
    const proposed = await submit('投票甲', '投票乙');
    const key = await keyOf(proposed.json().id);
    expect((await vote('投票甲', key, 1, 'reader')).statusCode).toBe(403);
    expect((await candidates('投票甲', 'reader')).find((c) => c.key === key)).toMatchObject({ mine: true, status: 'voting', agree: 0 });
    expect((await vote('投票甲', key, 1, 'other')).statusCode).toBe(200);
    expect((await publicRead('投票甲')).json().relations.map((r: { target: { label: string } }) => r.target.label)).toEqual(['投票乙']);
    expect((await publicRead('投票乙')).json().relations).toHaveLength(1);
    // One agreement against one disagreement is no majority.
    expect((await vote('投票甲', key, -1, 'admin')).statusCode).toBe(200);
    expect((await publicRead('投票甲')).json().relations).toEqual([]);
    expect((await candidates('投票甲')).find((c) => c.key === key)).toMatchObject({ status: 'voting', agree: 1, disagree: 1 });
    expect((await vote('投票甲', key, 0, 'admin')).statusCode).toBe(200);
    expect((await publicRead('投票甲')).json().relations).toHaveLength(1);
    expect((await db.select().from(tagSubmissionLog)).map((l) => l.action)).toEqual([
      'submit',
      'vote-approved',
      'vote-reverted',
      'vote-approved',
    ]);
  });
  it('puts waiting classification suggestions to the vote and leaves established and locked relations alone', async () => {
    await db.insert(tagGroupDefs).values([
      { id: 821, label: '建議分類', kind: 'group', sort: 1, createdAt: new Date() },
      { id: 822, label: '既有分類', kind: 'group', sort: 2, createdAt: new Date() },
      { id: 823, label: 'AI 猜的分類', kind: 'group', sort: 3, createdAt: new Date() },
    ]);
    await db.insert(tagGroupMembers).values([
      { tag: '候選人物', groupId: 821, source: 'wikidata', status: 'review', note: '曾任某職', updatedAt: new Date() },
      { tag: '候選人物', groupId: 822, source: 'legacy', status: 'confirmed', updatedAt: new Date() },
      // Readers are never asked about an AI guess (owner's decision, 2026-10-16).
      { tag: '候選人物', groupId: 823, source: 'ai', status: 'review', note: 'AI', updatedAt: new Date() },
    ]);
    const offered = await candidates('候選人物');
    expect(offered.map((c) => c.target)).toEqual(['建議分類']);
    expect(offered[0]).toMatchObject({ origin: 'suggestion', evidence: [{ text: '曾任某職' }] });
    const key = relationKey('候選人物', 'is-a', { groupId: 821 });
    expect((await vote('候選人物', key, 1, 'reader')).statusCode).toBe(200);
    expect(await db.select().from(tagGroupMembers).where(eq(tagGroupMembers.groupId, 821))).toMatchObject([
      { status: 'confirmed', reviewedBy: 'votes' },
    ]);
    expect(
      (await publicRead('候選人物'))
        .json()
        .relations.map((r: { target: { label: string } }) => r.target.label)
        .sort(),
    ).toEqual(['建議分類', '既有分類']);
    expect((await vote('候選人物', key, 0, 'reader')).statusCode).toBe(200);
    expect(await db.select().from(tagGroupMembers).where(eq(tagGroupMembers.groupId, 821))).toMatchObject([
      { status: 'review', reviewedBy: null },
    ]);
    // The established legacy membership is not on the ballot.
    expect((await vote('候選人物', relationKey('候選人物', 'is-a', { groupId: 822 }), -1, 'reader')).statusCode).toBe(404);
    // An administrator's decision is final: a locked proposal leaves the ballot.
    const locked = await submit('候選人物', '鎖定詞');
    expect((await review(locked.json().id, 'rejected')).statusCode).toBe(200);
    expect((await vote('候選人物', await keyOf(locked.json().id), 1, 'other')).statusCode).toBe(404);
  });
  it('offers tags that often share articles as related candidates', async () => {
    const at = new Date();
    await db.insert(articleTags).values([
      { articleId: 990001, tag: '共現甲', publishedAt: at },
      { articleId: 990001, tag: '共現乙', publishedAt: at },
      { articleId: 990002, tag: '共現甲', publishedAt: at },
      { articleId: 990002, tag: '共現乙', publishedAt: at },
    ]);
    try {
      const co = (await candidates('共現甲')).find((c) => c.target === '共現乙');
      expect(co).toMatchObject({ origin: 'cooccur', status: 'voting' });
      expect((await vote('共現甲', co!.key, 1)).statusCode).toBe(200);
      expect(await db.select().from(tagSubmissions).where(eq(tagSubmissions.source, 'cooccur'))).toMatchObject([
        { tag: '共現甲', target: '共現乙', relationType: 'related', status: 'approved' },
      ]);
      expect((await publicRead('共現乙')).json().relations.map((r: { target: { label: string } }) => r.target.label)).toEqual(['共現甲']);
    } finally {
      await db.execute(sql.raw('DELETE FROM article_tags WHERE article_id IN (990001, 990002)'));
    }
  });

  it('enforces 20 proposals per rolling day while allowing existing deduplication', async () => {
    for (let i = 0; i < 20; i++) expect((await submit('額度甲', `額度${i}`)).statusCode).toBe(201);
    const over = await submit('額度甲', '額度20');
    expect(over.statusCode).toBe(429);
    expect(over.headers['cache-control']).toContain('no-store');
    expect((await submit('額度甲', '額度0')).statusCode).toBe(200);
  });
  it('does not exceed the quota under simultaneous requests by the same reader', async () => {
    for (let i = 0; i < 19; i++) await submit('並行額度', `已有${i}`);
    const last = await Promise.all([submit('並行額度', '最後甲'), submit('並行額度', '最後乙'), submit('並行額度', '最後丙')]);
    expect(last.map((r) => r.statusCode).sort()).toEqual([201, 429, 429]);
    expect(await db.select().from(tagSubmissions)).toHaveLength(20);
  });

  it('keeps anonymous public cache while all credential headers and errors remain no-store', async () => {
    expect((await publicRead('快取甲')).headers['cache-control']).toBe('public, max-age=60');
    for (const header of ['cookie', 'authorization', 'x-service-token', 'x-api-key']) {
      for (const value of ['fake-fixture', '']) {
        const response = await publicRead('快取甲', { [header]: value });
        expect(response.statusCode).toBe(200);
        expect(response.headers['cache-control']).toBe('private, no-store');
      }
    }
    const missing = await app.inject('/api/v1/no-such-semantic-route');
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['cache-control']).toBe('no-store');
    expect((await review(999999)).statusCode).toBe(404);
  });
  it('protects submitted image blobs behind the administrator gate and omits blobs from the list', async () => {
    const proposal = await submitPicture(db, {
      tag: '私人圖',
      pictureKind: 'visual',
      image: Buffer.from('fixture-webp-bytes'),
      userId: actors.reader.id,
    });
    const imageUrl = `/auth/admin/tag-submissions/${proposal.submissionId}/image`;
    expect((await app.inject(imageUrl)).statusCode).toBe(401);
    expect((await app.inject({ url: imageUrl, headers: headers() })).statusCode).toBe(403);
    const image = await app.inject({ url: imageUrl, headers: headers('admin') });
    expect(image.statusCode).toBe(200);
    expect(image.headers['cache-control']).toContain('no-store');
    expect(image.headers['content-type']).toBe('image/webp');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
    const queue = await app.inject({ url: '/auth/admin/tag-submissions', headers: headers('admin') });
    expect(queue.body).not.toContain('fixture-webp-bytes');
    expect(queue.json().items[0].imageUrl).toBe(imageUrl);
    const missing = await app.inject({ url: '/auth/admin/tag-submissions/999999/image', headers: headers('admin') });
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['cache-control']).toContain('no-store');
  });
});
