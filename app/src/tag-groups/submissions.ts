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
import { approvePicture } from '../pictures/submissions.ts';
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
        typeof reason !== 'string' ||
        !reason.trim() ||
        reason.length > 1000
      )
        return reply.code(400).send({ error: '請選擇關係，填寫不同的有效標籤與 1–1000 字的說明' });
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
      if (type === 'is-a') {
        const ownGroups = await db
          .select({ label: tagGroupDefs.label })
          .from(tagGroupDefs)
          .where(and(eq(tagGroupDefs.label, tag), eq(tagGroupDefs.kind, 'group'), isNull(tagGroupDefs.deletedAt)));
        if (ownGroups.some((g) => g.label === tag))
          return reply.code(409).send({ error: '這個名稱已有分類，請在「分類與群組」調整上層，以保留既有分類 ID' });
      }
      const dedupeKey = relationKey(tag, type as RelationType, groups[0] ? { groupId: groups[0].id } : target);
      const result = await db.transaction(async (tx) => {
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
            reason: reason.trim(),
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
        if (inserted.affectedRows === 1 && inserted.insertId)
          await tx.insert(tagSubmissionLog).values({ submissionId: row.id, action: 'submit', userId: user.id, at });
        return { ...row, duplicate: !inserted.insertId };
      });
      if (!result) return reply.code(429).send({ error: '每人每天最多提出 20 筆關係' });
      return reply.code(result.duplicate ? 200 : 202).send(result);
    },
  );

  app.get<{ Querystring: { before?: string; status?: string } }>('/auth/admin/tag-submissions', async (request, reply) => {
    if (!(await guard(request, reply, true))) return reply;
    const status = request.query.status ?? 'pending';
    const before = request.query.before === undefined ? undefined : idOf(request.query.before);
    if (!['pending', 'approved', 'rejected'].includes(status) || before === null)
      return reply.code(400).send({ error: 'invalid status or cursor' });
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
      .where(and(eq(tagSubmissions.status, status as 'pending'), before ? lt(tagSubmissions.id, before) : undefined))
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
      if (!id || (status !== 'approved' && status !== 'rejected') || typeof reason !== 'string' || !reason.trim() || reason.length > 1000)
        return reply.code(400).send({ error: '請填寫審核結果與 1–1000 字的理由' });
      try {
        const result = await db.transaction(async (tx) => {
          // Lock graph before the individual row: one consistent lock order
          // protects simultaneous reverse-edge approvals from a write skew.
          const [lock] = await tx.select().from(tagRelationLock).where(eq(tagRelationLock.id, 1)).for('update');
          if (!lock) throw new ReviewConflict('審核鎖尚未就緒，請稍後再試');
          const [row] = await tx.select().from(tagSubmissions).where(eq(tagSubmissions.id, id)).for('update');
          if (!row) return null;
          if (row.status !== 'pending') throw new ReviewConflict('這筆投稿已審核，請重新整理');
          let rank = row.candidateRank;
          if (status === 'approved') {
            if (row.kind === 'relation' && row.relationType === 'is-a' && row.targetGroupId !== null) {
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
              const values = { status: 'confirmed' as const, reviewedBy: user.email, reviewedAt: at, updatedAt: at };
              await tx
                .insert(tagGroupMembers)
                .values({ tag: row.tag, groupId: group.id, source: 'admin', ...values })
                .onDuplicateKeyUpdate({ set: values });
              await tx.insert(tagGroupMemberLog).values({
                tag: row.tag,
                groupId: group.id,
                action: 'confirm',
                fromStatus: previous?.status ?? null,
                email: user.email,
                at,
              });
              await syncWritingTag(tx, row.tag, user.email);
            }
            if (row.kind === 'relation' && row.relationType === 'is-a' && row.targetGroupId === null) {
              try {
                if (!row.target || (await isACycle(tx as unknown as Db, row.tag, row.target)))
                  throw new ReviewConflict('上位分類不能形成循環');
              } catch (err) {
                throw new ReviewConflict((err as Error).message);
              }
            }
            if (row.kind === 'picture') {
              try {
                rank = (await approvePicture(tx as unknown as Db, row)).rank;
              } catch (err) {
                throw new ReviewConflict((err as Error).message);
              }
            }
          }
          const at = new Date();
          await tx
            .update(tagSubmissions)
            .set({ status, reviewedBy: user.id, reviewedAt: at, reviewReason: reason.trim(), candidateRank: rank })
            .where(eq(tagSubmissions.id, id));
          await tx.insert(tagSubmissionLog).values({ submissionId: id, action: status, userId: user.id, at, reason: reason.trim() });
          return { id, tag: row.tag, target: row.target, status };
        });
        if (!result) return reply.code(404).send({ error: 'no such submission' });
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
