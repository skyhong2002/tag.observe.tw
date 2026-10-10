import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { type TagPersonStatus, tagAvatarCandidates, tagPeople, tagPeopleLog } from '../db/schema.ts';

// /admin/avatars/: admins look over person tags and their sketch avatars,
// switch to another of the three candidates or hide the avatar
// (docs/tag-avatars.md). Every change is logged in tag_people_log.

type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
};

const STATUSES: TagPersonStatus[] = ['review', 'auto', 'chosen', 'hidden', 'nophoto'];
const PAGE = 60;

const imagePath = (tag: string, rank: number, version: number) =>
  `/auth/admin/avatars/${encodeURIComponent(tag)}/candidates/${rank}?v=${version.toString(36)}`;

export function registerAvatarAdmin(app: FastifyInstance, db: Db, { requireAdmin, origin }: Options) {
  app.get<{ Querystring: { status?: string; offset?: string } }>('/auth/admin/avatars', async (request, reply) => {
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
      .where(eq(tagPeople.status, status))
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
  app.get<{ Params: { tag: string; rank: string } }>('/auth/admin/avatars/:tag/candidates/:rank', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const [row] = await db
      .select({ image: tagAvatarCandidates.image })
      .from(tagAvatarCandidates)
      .where(and(eq(tagAvatarCandidates.tag, request.params.tag), eq(tagAvatarCandidates.rank, Number(request.params.rank) || 0)));
    if (!row) return reply.code(404).send({ error: 'no such candidate' });
    return reply.header('content-type', 'image/webp').header('cache-control', 'private, max-age=86400').send(row.image);
  });

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
}
