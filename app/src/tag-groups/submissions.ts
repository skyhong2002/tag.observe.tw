import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import { inkImage } from '../avatars/ink.ts';
import type { Db } from '../db/client.ts';
import {
  tagGroupDefs,
  tagGroupMemberLog,
  tagGroupMembers,
  tagRelationLock,
  tagSubmissionLog,
  tagSubmissions,
  users,
} from '../db/schema.ts';
import { refreshPages } from '../pictures/refresh.ts';
import { approvePicture, type PictureMetadata, revokePicture } from '../pictures/submissions.ts';
import { castRelationVote, forgetVotingCount, relationCandidates, VoteRefused } from './relation-votes.ts';
import { CURATED_GROUPS } from './rules.ts';
import { isACycle, RELATION_TYPES, type RelationType, relationKey, validSemanticTag } from './semantic.ts';
import { syncWritingTag } from './writing.ts';

type Options = {
  currentUser: (request: FastifyRequest) => Promise<SessionUser | null>;
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
  uiOrigin?: string | null;
};
class ReviewConflict extends Error {}
const idOf = (raw: string) => (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : null);

type SubmissionRow = typeof tagSubmissions.$inferSelect;

/** Makes a locked relation row take effect; throws ReviewConflict when it cannot. Caller holds tag_relation_lock. */
async function applyRelation(tx: Db, row: SubmissionRow, email: string) {
  if (row.relationType === 'is-a' && row.targetGroupId !== null) {
    const [group] = await tx
      .select()
      .from(tagGroupDefs)
      .where(and(eq(tagGroupDefs.id, row.targetGroupId), isNull(tagGroupDefs.deletedAt)))
      .for('update');
    if (!group) throw new ReviewConflict('這個分類已刪除，請重新提出關係');
    const [previous] = await tx
      .select()
      .from(tagGroupMembers)
      .where(and(eq(tagGroupMembers.tag, row.tag), eq(tagGroupMembers.groupId, group.id)))
      .for('update');
    const at = new Date();
    const values = { status: 'confirmed' as const, reviewedBy: email, reviewedAt: at, updatedAt: at };
    await tx
      .insert(tagGroupMembers)
      .values({ tag: row.tag, groupId: group.id, source: 'admin', ...values })
      .onDuplicateKeyUpdate({ set: values });
    await tx.insert(tagGroupMemberLog).values({
      tag: row.tag,
      groupId: group.id,
      action: 'confirm',
      fromStatus: previous?.status ?? null,
      email,
      at,
    });
    await syncWritingTag(tx, row.tag, email);
  }
  if (row.relationType === 'is-a' && row.targetGroupId === null) {
    try {
      if (!row.target || (await isACycle(tx, row.tag, row.target))) throw new ReviewConflict('上位分類不能形成循環');
    } catch (err) {
      throw new ReviewConflict((err as Error).message);
    }
  }
}

/** Undoes applyRelation: a group membership it confirmed goes back to its earlier state. Other relations simply stop being approved. */
async function revokeRelation(tx: Db, row: SubmissionRow, email: string) {
  if (row.relationType !== 'is-a' || row.targetGroupId === null) return;
  const [confirmed] = await tx
    .select({ fromStatus: tagGroupMemberLog.fromStatus })
    .from(tagGroupMemberLog)
    .where(
      and(eq(tagGroupMemberLog.tag, row.tag), eq(tagGroupMemberLog.groupId, row.targetGroupId), eq(tagGroupMemberLog.action, 'confirm')),
    )
    .orderBy(desc(tagGroupMemberLog.id))
    .limit(1);
  const at = new Date();
  const where = and(eq(tagGroupMembers.tag, row.tag), eq(tagGroupMembers.groupId, row.targetGroupId));
  if (!confirmed?.fromStatus) await tx.delete(tagGroupMembers).where(where);
  else
    await tx
      .update(tagGroupMembers)
      .set({ status: confirmed.fromStatus as typeof tagGroupMembers.$inferSelect.status, reviewedBy: email, reviewedAt: at, updatedAt: at })
      .where(where);
  await tx.insert(tagGroupMemberLog).values({
    tag: row.tag,
    groupId: row.targetGroupId,
    action: 'revoke',
    fromStatus: 'confirmed',
    email,
    at,
  });
  await syncWritingTag(tx, row.tag, email);
}

export function registerTagSubmissions(app: FastifyInstance, db: Db, { currentUser, requireAdmin, origin, uiOrigin }: Options) {
  const guard = async (request: FastifyRequest, reply: FastifyReply, admin = false, write = false) => {
    reply.header('cache-control', 'private, no-store');
    if (write && request.headers.origin !== origin) {
      reply.code(403).send({ error: 'same-origin requests only' });
      return null;
    }
    if (admin) return requireAdmin(request, reply);
    const user = await currentUser(request);
    if (!user) reply.code(401).send({ error: '請先登入' });
    return user;
  };

  app.post<{ Params: { tag: string }; Body: { type?: unknown; target?: unknown; reason?: unknown } }>(
    '/auth/tags/:tag/relations',
    { bodyLimit: 8192 },
    async (request, reply) => {
      const user = await guard(request, reply, false, true);
      if (!user) return reply;
      const { tag } = request.params;
      const { type, target, reason } = request.body ?? {};
      if (
        !validSemanticTag(tag) ||
        !validSemanticTag(target) ||
        tag === target ||
        !RELATION_TYPES.includes(type as RelationType) ||
        (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > 1000))
      )
        return reply.code(400).send({ error: '請選擇關係，填寫不同的有效標籤；說明可留空，最多 1000 字' });
      const why = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
      const groups =
        type === 'is-a'
          ? (
              await db
                .select({ id: tagGroupDefs.id, label: tagGroupDefs.label })
                .from(tagGroupDefs)
                .where(and(eq(tagGroupDefs.label, target), eq(tagGroupDefs.kind, 'group'), isNull(tagGroupDefs.deletedAt)))
            ).filter((g) => g.label === target)
          : [];
      if (groups.length > 1) return reply.code(409).send({ error: '有多個同名分類，請管理員先整理分類' });
      if (groups[0] && CURATED_GROUPS.has(groups[0].id))
        return reply
          .code(409)
          .send({ error: `「${groups[0].label}」依官方名單維護，不開放投票；名單有誤請從頁尾「聯絡與移除請求」告訴我們` });
      if (type === 'is-a') {
        const ownGroups = await db
          .select({ label: tagGroupDefs.label })
          .from(tagGroupDefs)
          .where(and(eq(tagGroupDefs.label, tag), eq(tagGroupDefs.kind, 'group'), isNull(tagGroupDefs.deletedAt)));
        if (ownGroups.some((g) => g.label === tag))
          return reply.code(409).send({ error: '這個名稱已有分類，請在「分類與群組」調整上層，以保留既有分類 ID' });
      }
      const dedupeKey = relationKey(tag, type as RelationType, groups[0] ? { groupId: groups[0].id } : target);
      const result = await db
        .transaction(async (tx) => {
          // Same lock order as the admin endpoint: relation graph first, then rows.
          const [lock] = await tx.select().from(tagRelationLock).where(eq(tagRelationLock.id, 1)).for('update');
          if (!lock) throw new ReviewConflict('投稿暫時無法處理，請稍後再試');
          await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
          const [existing] = await tx
            .select({ id: tagSubmissions.id, status: tagSubmissions.status })
            .from(tagSubmissions)
            .where(eq(tagSubmissions.dedupeKey, dedupeKey));
          if (existing) return { ...existing, duplicate: true };
          const [{ n }] = await tx
            .select({ n: sql<number>`COUNT(*)` })
            .from(tagSubmissions)
            .where(
              and(
                eq(tagSubmissions.createdBy, user.id),
                eq(tagSubmissions.kind, 'relation'),
                gte(tagSubmissions.createdAt, new Date(Date.now() - 86_400_000)),
              ),
            );
          if (Number(n) >= 20) return null;
          const at = new Date();
          const [inserted] = await tx
            .insert(tagSubmissions)
            .values({
              kind: 'relation',
              tag,
              relationType: type as RelationType,
              target,
              targetGroupId: groups[0]?.id ?? null,
              reason: why,
              source: user.role === 'admin' ? 'manual' : 'submission',
              status: 'pending',
              createdBy: user.id,
              createdAt: at,
              dedupeKey,
            })
            .onDuplicateKeyUpdate({ set: { dedupeKey } });
          const [row] = await tx
            .select({ id: tagSubmissions.id, status: tagSubmissions.status })
            .from(tagSubmissions)
            .where(eq(tagSubmissions.dedupeKey, dedupeKey))
            .for('update');
          if (!(inserted.affectedRows === 1 && inserted.insertId)) return { ...row, duplicate: true };
          await tx.insert(tagSubmissionLog).values({ submissionId: row.id, action: 'submit', userId: user.id, at });
          // Other readers vote on it at /tag/<tag>/relations/ (relation-votes.ts).
          return { id: row.id, status: 'pending' as const, duplicate: false };
        })
        .catch((err) => {
          if (err instanceof ReviewConflict) return { error: err.message };
          throw err;
        });
      if (!result) return reply.code(429).send({ error: '每人每天最多提出 20 筆關係' });
      if ('error' in result) return reply.code(409).send({ error: result.error });
      if (!result.duplicate) {
        forgetVotingCount(tag);
        refreshPages(uiOrigin ?? null, tag);
      }
      return reply.code(result.duplicate ? 200 : 201).send(result);
    },
  );

  // The relations page: candidates with counts; signed-in readers also get their own votes.
  app.get<{ Params: { tag: string } }>('/auth/tags/:tag/relations/candidates', async (request, reply) => {
    reply.header('cache-control', 'private, no-store');
    const { tag } = request.params;
    if (!validSemanticTag(tag)) return reply.code(400).send({ error: '標籤須為 1–60 字且不含控制字元或前後空白' });
    const user = await currentUser(request);
    return {
      tag,
      signedIn: !!user,
      admin: user?.role === 'admin',
      candidates: await relationCandidates(db, tag, user?.id ?? null),
    };
  });

  app.put<{ Params: { tag: string }; Body: { key?: unknown; value?: unknown } }>(
    '/auth/tags/:tag/relations/vote',
    { bodyLimit: 1024 },
    async (request, reply) => {
      const user = await guard(request, reply, false, true);
      if (!user) return reply;
      const { tag } = request.params;
      const { key, value } = request.body ?? {};
      if (!validSemanticTag(tag) || typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key) || ![1, 0, -1].includes(value as number))
        return reply.code(400).send({ error: '請選擇同意、不同意或取消' });
      try {
        await db.transaction(async (tx) => {
          const [lock] = await tx.select().from(tagRelationLock).where(eq(tagRelationLock.id, 1)).for('update');
          if (!lock) throw new VoteRefused('投票暫時無法處理，請稍後再試', 409);
          try {
            await castRelationVote(
              tx as unknown as Db,
              { apply: applyRelation, revoke: revokeRelation },
              user.id,
              tag,
              key,
              value as -1 | 0 | 1,
            );
          } catch (err) {
            if (err instanceof ReviewConflict) throw new VoteRefused(err.message, 409);
            throw err;
          }
        });
      } catch (err) {
        if (err instanceof VoteRefused) return reply.code(err.code).send({ error: err.message });
        throw err;
      }
      refreshPages(uiOrigin ?? null, tag);
      return { tag, candidates: await relationCandidates(db, tag, user.id) };
    },
  );

  app.get<{ Querystring: { before?: string; status?: string; kind?: string } }>('/auth/admin/tag-submissions', async (request, reply) => {
    if (!(await guard(request, reply, true))) return reply;
    const status = request.query.status ?? 'approved';
    const kind = request.query.kind;
    const before = request.query.before === undefined ? undefined : idOf(request.query.before);
    if (
      !['pending', 'approved', 'rejected', 'revoked'].includes(status) ||
      before === null ||
      (kind && !['relation', 'picture'].includes(kind))
    )
      return reply.code(400).send({ error: 'invalid status, kind or cursor' });
    // Never SELECT the image blobs into the list; the guarded image endpoint
    // streams one candidate only when a reviewer actually opens it.
    const rows = await db
      .select({
        id: tagSubmissions.id,
        kind: tagSubmissions.kind,
        tag: tagSubmissions.tag,
        type: tagSubmissions.relationType,
        target: tagSubmissions.target,
        reason: tagSubmissions.reason,
        status: tagSubmissions.status,
        source: tagSubmissions.source,
        createdBy: tagSubmissions.createdBy,
        createdAt: tagSubmissions.createdAt,
        reviewedBy: tagSubmissions.reviewedBy,
        reviewedAt: tagSubmissions.reviewedAt,
        reviewReason: tagSubmissions.reviewReason,
        pictureKind: tagSubmissions.pictureKind,
        rank: tagSubmissions.candidateRank,
        rightsConfirmed: tagSubmissions.rightsConfirmed,
      })
      .from(tagSubmissions)
      .where(
        and(
          eq(tagSubmissions.status, status as 'pending'),
          kind ? eq(tagSubmissions.kind, kind as 'relation') : undefined,
          before ? lt(tagSubmissions.id, before) : undefined,
        ),
      )
      .orderBy(desc(tagSubmissions.id))
      .limit(31);
    return {
      items: rows.slice(0, 30).map((row) => ({
        ...row,
        createdBy: `使用者 #${row.createdBy}`,
        imageUrl: row.kind === 'picture' ? `/auth/admin/tag-submissions/${row.id}/image` : null,
      })),
      next: rows.length > 30 ? rows[29].id : null,
    };
  });

  // The admin overview's counts: what readers published in the last week, by kind.
  app.get('/auth/admin/tag-submissions/summary', async (request, reply) => {
    if (!(await guard(request, reply, true))) return reply;
    const since = new Date(Date.now() - 7 * 86_400_000);
    const rows = await db
      .select({ kind: tagSubmissions.kind, status: tagSubmissions.status, n: sql<number>`COUNT(*)` })
      .from(tagSubmissions)
      .where(gte(tagSubmissions.createdAt, since))
      .groupBy(tagSubmissions.kind, tagSubmissions.status);
    const count = (kind: string, status: string) => Number(rows.find((r) => r.kind === kind && r.status === status)?.n ?? 0);
    return {
      since: since.toISOString(),
      relation: { pending: count('relation', 'pending'), approved: count('relation', 'approved'), revoked: count('relation', 'revoked') },
      picture: { approved: count('picture', 'approved'), revoked: count('picture', 'revoked') },
    };
  });

  app.get<{ Params: { id: string } }>('/auth/admin/tag-submissions/:id/image', async (request, reply) => {
    if (!(await guard(request, reply, true))) return reply;
    const id = idOf(request.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid id' });
    const [row] = await db
      .select({ kind: tagSubmissions.pictureKind, image: tagSubmissions.image })
      .from(tagSubmissions)
      .where(and(eq(tagSubmissions.id, id), eq(tagSubmissions.kind, 'picture')));
    if (!row?.image) return reply.code(404).send({ error: 'no such image' });
    return reply
      .header('content-type', 'image/webp')
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "default-src 'none'")
      .send(row.kind === 'avatar' ? await inkImage(row.image, 'color') : row.image);
  });

  app.put<{ Params: { id: string }; Body: { status?: unknown; reason?: unknown } }>(
    '/auth/admin/tag-submissions/:id',
    { bodyLimit: 8192 },
    async (request, reply) => {
      const user = await guard(request, reply, true, true);
      if (!user) return reply;
      const id = idOf(request.params.id);
      const { status, reason } = request.body ?? {};
      if (
        !id ||
        (status !== 'approved' && status !== 'rejected' && status !== 'revoked') ||
        typeof reason !== 'string' ||
        !reason.trim() ||
        reason.length > 1000
      )
        return reply.code(400).send({ error: '請填寫處理結果與 1–1000 字的理由' });
      try {
        const result = await db.transaction(async (tx) => {
          // Lock graph before the individual row: one consistent lock order
          // protects simultaneous reverse-edge approvals from a write skew.
          const [lock] = await tx.select().from(tagRelationLock).where(eq(tagRelationLock.id, 1)).for('update');
          if (!lock) throw new ReviewConflict('審核鎖尚未就緒，請稍後再試');
          const [row] = await tx.select().from(tagSubmissions).where(eq(tagSubmissions.id, id)).for('update');
          if (!row) return null;
          // Submissions are public on arrival; revoking takes one down. Pending rows predate that.
          if (status === 'revoked' ? row.status !== 'approved' : row.status !== 'pending')
            throw new ReviewConflict(status === 'revoked' ? '只能撤下公開中的投稿，請重新整理' : '這筆投稿已處理，請重新整理');
          let rank = row.candidateRank;
          let pictureMeta = row.pictureMeta;
          try {
            if (status === 'approved' && row.kind === 'relation') await applyRelation(tx as unknown as Db, row, user.email);
            if (status === 'approved' && row.kind === 'picture') {
              const published = await approvePicture(tx as unknown as Db, row);
              rank = published.rank;
              pictureMeta = { ...(row.pictureMeta ?? {}), previous: published.previous } as PictureMetadata;
            }
            if (status === 'revoked' && row.kind === 'relation') await revokeRelation(tx as unknown as Db, row, user.email);
            if (status === 'revoked' && row.kind === 'picture') await revokePicture(tx as unknown as Db, row);
          } catch (err) {
            throw err instanceof ReviewConflict ? err : new ReviewConflict((err as Error).message);
          }
          const at = new Date();
          await tx
            .update(tagSubmissions)
            .set({ status, reviewedBy: user.id, reviewedAt: at, reviewReason: reason.trim(), candidateRank: rank, pictureMeta })
            .where(eq(tagSubmissions.id, id));
          await tx.insert(tagSubmissionLog).values({ submissionId: id, action: status, userId: user.id, at, reason: reason.trim() });
          return { id, tag: row.tag, target: row.target, status };
        });
        if (!result) return reply.code(404).send({ error: 'no such submission' });
        forgetVotingCount(result.tag);
        if (result.target) forgetVotingCount(result.target);
        refreshPages(uiOrigin ?? null, result.tag);
        if (result.target) refreshPages(uiOrigin ?? null, result.target);
        return result;
      } catch (err) {
        if (err instanceof ReviewConflict) return reply.code(409).send({ error: err.message });
        throw err;
      }
    },
  );
}
