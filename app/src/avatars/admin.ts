import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import type { JobQueue } from '../admin/routes.ts';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { type TagPersonStatus, tagAvatarCandidates, tagPeople, tagPeopleLog } from '../db/schema.ts';
import { inkImage } from './ink.ts';

// /admin/avatars/: admins look over person tags and their sketch avatars,
// switch to another of the three candidates or hide the avatar
// (docs/tag-avatars.md). Every change is logged in tag_people_log. For a
// person Commons has no usable photo of, an admin uploads one: the gateway
// only shrinks it and queues it, and the worker sketches it in its own
// process (the face models do not belong in the gateway).

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
  queue: () => JobQueue;
};

// A phone photo, base64 in JSON: up to about 11 MB of image.
const PHOTO_LIMIT = 15 * 1024 * 1024;
const PHOTO_JOB = 'tag-avatar-photo';

const STATUSES: TagPersonStatus[] = ['review', 'auto', 'chosen', 'hidden', 'nophoto'];
const PAGE = 60;

const imagePath = (tag: string, rank: number, version: number) =>
  `/auth/admin/avatars/${encodeURIComponent(tag)}/candidates/${rank}?v=${version.toString(36)}`;

export function registerAvatarAdmin(app: FastifyInstance, db: Db, { requireAdmin, origin, queue }: Options) {
  // ?tag= looks one person tag up (the tag page's 「換圖」 link).
  app.get<{ Querystring: { status?: string; offset?: string; tag?: string } }>('/auth/admin/avatars', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    reply.header('cache-control', 'no-store');
    const status = STATUSES.find((s) => s === request.query.status) ?? 'review';
    const offset = Math.max(0, Number(request.query.offset) || 0);
    const counts = Object.fromEntries(
      (await db.select({ status: tagPeople.status, n: sql<number>`COUNT(*)` }).from(tagPeople).groupBy(tagPeople.status)).map((r) => [
        r.status,
        Number(r.n),
      ]),
    );
    const people = await db
      .select()
      .from(tagPeople)
      .where(request.query.tag?.trim() ? eq(tagPeople.tag, request.query.tag.trim()) : eq(tagPeople.status, status))
      .orderBy(desc(tagPeople.checkedAt), asc(tagPeople.tag))
      .limit(PAGE)
      .offset(offset);
    const tags = people.map((p) => p.tag);
    const candidates = tags.length
      ? await db
          .select({
            tag: tagAvatarCandidates.tag,
            rank: tagAvatarCandidates.rank,
            file: tagAvatarCandidates.file,
            pageUrl: tagAvatarCandidates.pageUrl,
            license: tagAvatarCandidates.license,
            artist: tagAvatarCandidates.artist,
            score: tagAvatarCandidates.score,
            scores: tagAvatarCandidates.scores,
            verdict: tagAvatarCandidates.verdict,
          })
          .from(tagAvatarCandidates)
          .where(inArray(tagAvatarCandidates.tag, tags))
          .orderBy(asc(tagAvatarCandidates.tag), asc(tagAvatarCandidates.rank))
      : [];
    return {
      status,
      counts,
      offset,
      next: people.length === PAGE ? offset + PAGE : null,
      people: people.map((p) => ({
        ...p,
        candidates: candidates
          .filter((c) => c.tag === p.tag)
          .map(({ tag: _, ...c }) => ({ ...c, image: imagePath(p.tag, c.rank, p.checkedAt.getTime()) })),
      })),
    };
  });

  // Every candidate, shown or not, for the review page only.
  app.get<{ Params: { tag: string; rank: string }; Querystring: { layer?: string } }>(
    '/auth/admin/avatars/:tag/candidates/:rank',
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return reply;
      const [row] = await db
        .select({ image: tagAvatarCandidates.image })
        .from(tagAvatarCandidates)
        .where(and(eq(tagAvatarCandidates.tag, request.params.tag), eq(tagAvatarCandidates.rank, Number(request.params.rank) || 0)));
      if (!row) return reply.code(404).send({ error: 'no such candidate' });
      return reply
        .header('content-type', 'image/webp')
        .header('cache-control', 'private, max-age=86400')
        .send(await inkImage(row.image, (['fill', 'color'] as const).find((l) => l === request.query.layer) ?? 'ink'));
    },
  );

  // { rank: 1–3 } shows that candidate; { rank: null } hides the avatar.
  app.put<{ Params: { tag: string }; Body: { rank?: unknown } }>('/auth/admin/avatars/:tag', async (request, reply) => {
    if (request.headers.origin !== origin) {
      reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
      return reply;
    }
    const user = await requireAdmin(request, reply);
    if (!user) return reply;
    const { tag } = request.params;
    const rank = request.body?.rank;
    if (rank !== null && !(typeof rank === 'number' && Number.isInteger(rank)))
      return reply.code(400).send({ error: 'rank must be a candidate rank, or null to hide' });
    const [person] = await db.select().from(tagPeople).where(eq(tagPeople.tag, tag));
    if (!person) return reply.code(404).send({ error: 'no such person tag' });
    if (rank !== null) {
      const [exists] = await db
        .select({ rank: tagAvatarCandidates.rank })
        .from(tagAvatarCandidates)
        .where(and(eq(tagAvatarCandidates.tag, tag), eq(tagAvatarCandidates.rank, rank)));
      if (!exists) return reply.code(404).send({ error: 'no such candidate' });
    }
    const at = new Date();
    const set = {
      status: (rank === null ? 'hidden' : 'chosen') as TagPersonStatus,
      shownRank: rank,
      reviewedBy: user.email,
      reviewedAt: at,
    };
    await db.transaction(async (tx) => {
      await tx.update(tagPeople).set(set).where(eq(tagPeople.tag, tag));
      await tx
        .insert(tagPeopleLog)
        .values({ tag, action: rank === null ? 'hide' : 'show', fromRank: person.shownRank, toRank: rank, email: user.email, at });
    });
    return { tag, ...set };
  });

  // { image: base64 } → a queued sketch job; poll GET /auth/admin/avatars/jobs/:id.
  app.post<{ Params: { tag: string }; Body: { image?: unknown } }>(
    '/auth/admin/avatars/:tag/photo',
    { bodyLimit: PHOTO_LIMIT },
    async (request, reply) => {
      if (request.headers.origin !== origin) {
        reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
        return reply;
      }
      const user = await requireAdmin(request, reply);
      if (!user) return reply;
      const { tag } = request.params;
      const [person] = await db.select({ tag: tagPeople.tag }).from(tagPeople).where(eq(tagPeople.tag, tag));
      if (!person) return reply.code(404).send({ error: '這個標籤還沒比對到人物' });
      const raw = typeof request.body?.image === 'string' ? Buffer.from(request.body.image, 'base64') : null;
      if (!raw?.length) return reply.code(400).send({ error: 'image (base64) required' });
      // The size the Commons photos come in (1200px), so the face rules mean the same.
      let photo: Buffer;
      try {
        photo = await sharp(raw).rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
      } catch (err) {
        return reply.code(400).send({ error: `讀不了這張圖：${(err as Error).message}` });
      }
      const job = await queue().add(
        PHOTO_JOB,
        { tag, image: photo.toString('base64'), email: user.email },
        { jobId: `${PHOTO_JOB}-${Date.now()}`, removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 } },
      );
      return reply.code(202).send({ jobId: job.id });
    },
  );

  app.get<{ Params: { id: string } }>('/auth/admin/avatars/jobs/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    reply.header('cache-control', 'no-store');
    if (!request.params.id.startsWith(`${PHOTO_JOB}-`)) return reply.code(404).send({ error: 'no such job' });
    const job = await queue().getJob(request.params.id);
    if (!job) return reply.code(404).send({ error: 'no such job' });
    const result = (job.returnvalue ?? null) as { error?: string } | null;
    return { id: job.id, state: await job.getState(), result, error: job.failedReason ?? result?.error ?? null };
  });
}
