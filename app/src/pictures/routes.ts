import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import type { JobQueue } from '../admin/routes.ts';
import type { SessionUser } from '../auth/google-login.ts';
import { inkImage } from '../avatars/ink.ts';
import type { Db } from '../db/client.ts';
import {
  tagAvatarCandidates,
  tagGroupMembers,
  tagPeople,
  tagPeopleLog,
  tagPictureVotes,
  tagVisualCandidates,
  tagVisuals,
} from '../db/schema.ts';
import { recolourLogo } from '../tag-visuals/recolour.ts';
import { visualMime } from '../v1/tag-visual.ts';
import { refreshPages } from './refresh.ts';
import { submitPicture } from './submissions.ts';
import { applyVotes, castVote, type PictureKind, pictureKind, tally, uploadsToday } from './votes.ts';

// /tag/{tag}/picture/: any signed-in reader votes for a tag's picture or
// uploads one (docs/tag-pictures.md). A person tag's photo is sketched by the
// worker (the face models stay out of the gateway); any other tag's picture
// is cut out, trimmed and recoloured here. Uploads wait for administrator
// approval before becoming candidates or counting as the uploader's vote.
// The most-voted candidate is shown unless an admin chose or hid one.

type Options = {
  currentUser: (request: FastifyRequest) => Promise<SessionUser | null>;
  origin: string;
  queue: () => JobQueue;
  /** The web server, told to rebuild the home and tag pages when a picture changes. */
  uiOrigin?: string | null;
};

// A phone photo, base64 in JSON: up to about 11 MB of image.
const UPLOAD_LIMIT = 15 * 1024 * 1024;
const PER_DAY = 20;
const PHOTO_JOB = 'tag-avatar-photo';

const imagePath = (tag: string, rank: number, size: 'small' | 'large' = 'small') =>
  `/auth/pictures/${encodeURIComponent(tag)}/candidates/${rank}${size === 'large' ? '?size=large' : ''}`;

export function registerPictureRoutes(app: FastifyInstance, db: Db, { currentUser, origin, queue, uiOrigin = null }: Options) {
  const signedIn = async (request: FastifyRequest, reply: FastifyReply, write = false) => {
    reply.header('cache-control', 'no-store');
    if (write && request.headers.origin !== origin) {
      reply.code(403).send({ error: 'same-origin requests only' });
      return null;
    }
    const user = await currentUser(request);
    if (!user) reply.code(401).send({ error: '請先登入' });
    return user;
  };

  app.get<{ Params: { tag: string } }>('/auth/pictures/:tag', async (request, reply) => {
    const user = await signedIn(request, reply);
    if (!user) return reply;
    const { tag } = request.params;
    if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
    const kind = await pictureKind(db, tag);
    const [votes, mine] = await Promise.all([
      tally(db, tag, kind),
      db
        .select({ rank: tagPictureVotes.rank })
        .from(tagPictureVotes)
        .where(and(eq(tagPictureVotes.tag, tag), eq(tagPictureVotes.kind, kind), eq(tagPictureVotes.userId, user.id))),
    ]);
    const state =
      kind === 'avatar'
        ? (await db.select({ status: tagPeople.status, shownRank: tagPeople.shownRank }).from(tagPeople).where(eq(tagPeople.tag, tag)))[0]
        : (
            await db.select({ status: tagVisuals.status, shownRank: tagVisuals.shownRank }).from(tagVisuals).where(eq(tagVisuals.tag, tag))
          )[0];
    const candidates =
      kind === 'avatar'
        ? (
            await db
              .select({
                rank: tagAvatarCandidates.rank,
                file: tagAvatarCandidates.file,
                pageUrl: tagAvatarCandidates.pageUrl,
                license: tagAvatarCandidates.license,
                uploadedBy: tagAvatarCandidates.uploadedBy,
              })
              .from(tagAvatarCandidates)
              .where(eq(tagAvatarCandidates.tag, tag))
              .orderBy(asc(tagAvatarCandidates.rank))
          ).map((c) => ({
            rank: c.rank,
            kind: 'sketch' as const,
            value: null,
            note: c.pageUrl ? (c.license ?? 'Wikimedia Commons') : c.file,
            pageUrl: c.pageUrl || null,
            image: `${imagePath(tag, c.rank)}?kind=avatar`,
            large: null,
            uploadedBy: c.uploadedBy,
          }))
        : (
            await db
              .select({
                rank: tagVisualCandidates.rank,
                kind: tagVisualCandidates.kind,
                value: tagVisualCandidates.value,
                note: tagVisualCandidates.note,
                pageUrl: tagVisualCandidates.pageUrl,
                uploadedBy: tagVisualCandidates.uploadedBy,
                hasImage: sql<number>`${tagVisualCandidates.image} IS NOT NULL`,
                hasLarge: sql<number>`${tagVisualCandidates.large} IS NOT NULL`,
              })
              .from(tagVisualCandidates)
              .where(eq(tagVisualCandidates.tag, tag))
              .orderBy(asc(tagVisualCandidates.rank))
          ).map((c) => ({
            rank: c.rank,
            kind: c.kind,
            value: c.value,
            note: c.note,
            pageUrl: c.pageUrl,
            image: Number(c.hasImage) ? `${imagePath(tag, c.rank)}?kind=visual` : null,
            large: Number(c.hasLarge) ? imagePath(tag, c.rank, 'large') : null,
            uploadedBy: c.uploadedBy,
          }));
    const status = state?.status ?? null;
    return {
      tag,
      kind,
      status,
      // An admin chose (or hid) the picture: votes still count, but do not change it.
      locked: status === 'chosen' || status === 'hidden',
      hidden: status === 'hidden',
      // Only a shown status puts a candidate in use (an AI pick waiting for review is not).
      shownRank:
        status && ['auto', 'chosen', 'voted', ...(kind === 'avatar' ? ['review'] : [])].includes(status)
          ? (state?.shownRank ?? null)
          : null,
      myVote: mine[0]?.rank ?? null,
      admin: user.role === 'admin',
      uploadsLeft: Math.max(0, PER_DAY - (await uploadsToday(db, user.id))),
      candidates: candidates.map(({ uploadedBy, ...c }) => ({
        ...c,
        votes: votes.get(c.rank) ?? 0,
        uploaded: uploadedBy !== null,
        mine: uploadedBy === user.id,
      })),
    };
  });

  app.get<{ Params: { tag: string; rank: string }; Querystring: { size?: string } }>(
    '/auth/pictures/:tag/candidates/:rank',
    async (request, reply) => {
      if (!(await currentUser(request))) return reply.code(401).send({ error: '請先登入' });
      const { tag } = request.params;
      const rank = Number(request.params.rank) || 0;
      if ((await pictureKind(db, tag)) === 'avatar') {
        const [c] = await db
          .select({ image: tagAvatarCandidates.image })
          .from(tagAvatarCandidates)
          .where(and(eq(tagAvatarCandidates.tag, tag), eq(tagAvatarCandidates.rank, rank)));
        if (!c) return reply.code(404).send({ error: 'no such candidate' });
        return reply
          .header('content-type', 'image/webp')
          .header('cache-control', 'private, max-age=300')
          .send(await inkImage(c.image, 'color'));
      }
      const large = request.query.size === 'large';
      const [c] = await db
        .select({ kind: tagVisualCandidates.kind, image: large ? tagVisualCandidates.large : tagVisualCandidates.image })
        .from(tagVisualCandidates)
        .where(and(eq(tagVisualCandidates.tag, tag), eq(tagVisualCandidates.rank, rank)));
      if (!c?.image) return reply.code(404).send({ error: 'no picture' });
      return reply
        .header('content-type', visualMime(c.kind))
        .header('cache-control', 'private, max-age=300')
        .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'")
        .send(c.image);
    },
  );

  // Identity corrections survive automatic rechecks; keep historical portraits
  // and votes separate from the non-person picture candidates.
  app.put<{ Params: { tag: string }; Body: { kind?: unknown } }>('/auth/pictures/:tag/kind', async (request, reply) => {
    const user = await signedIn(request, reply, true);
    if (!user) return reply;
    if (user.role !== 'admin') return reply.code(403).send({ error: '只有管理員可以更正標籤種類' });
    const { tag } = request.params;
    if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
    if (request.body?.kind !== 'visual') return reply.code(400).send({ error: 'kind must be visual' });
    const changed = await db.transaction(async (tx) => {
      const [person] = await tx.select().from(tagPeople).where(eq(tagPeople.tag, tag)).for('update');
      if (person?.status === 'nonhuman') return true;
      if (!person?.wikidataId) return false;
      const at = new Date();
      await tx
        .update(tagPeople)
        .set({
          status: 'nonhuman',
          wikidataId: null,
          label: null,
          description: null,
          facts: null,
          shownRank: null,
          note: `管理員更正為非人物；原比對：${person.wikidataId} ${person.label ?? ''}`.slice(0, 120),
          reviewedBy: user.email,
          reviewedAt: at,
        })
        .where(eq(tagPeople.tag, tag));
      await tx
        .delete(tagGroupMembers)
        .where(
          and(eq(tagGroupMembers.tag, tag), eq(tagGroupMembers.source, 'person'), sql`${tagGroupMembers.status} IN ('auto', 'review')`),
        );
      await tx.insert(tagPeopleLog).values({ tag, action: 'nonhuman', fromRank: person.shownRank, toRank: null, email: user.email, at });
      return true;
    });
    if (!changed) return reply.code(409).send({ error: '這個標籤目前沒有比對到人物' });
    refreshPages(uiOrigin, tag);
    return { tag, kind: 'visual' };
  });

  // { rank } votes for that candidate; { rank: null } takes the vote back.
  app.put<{ Params: { tag: string }; Body: { rank?: unknown } }>('/auth/pictures/:tag/vote', async (request, reply) => {
    const user = await signedIn(request, reply, true);
    if (!user) return reply;
    const { tag } = request.params;
    const rank = request.body?.rank;
    if (rank !== null && !(typeof rank === 'number' && Number.isInteger(rank)))
      return reply.code(400).send({ error: 'rank must be a candidate rank, or null' });
    const kind = await pictureKind(db, tag);
    if (rank !== null) {
      const table = kind === 'avatar' ? tagAvatarCandidates : tagVisualCandidates;
      const [c] = await db
        .select({ rank: table.rank })
        .from(table)
        .where(and(eq(table.tag, tag), eq(table.rank, rank)));
      if (!c) return reply.code(404).send({ error: 'no such candidate' });
    }
    const shownRank = await castVote(db, tag, kind, user.id, rank);
    refreshPages(uiOrigin, tag);
    return { tag, shownRank };
  });

  // { image: base64, agree: true }: a person's photo is queued for the worker
  // (poll GET /auth/pictures/jobs/:id); any other tag's picture is done here.
  app.post<{ Params: { tag: string }; Body: { image?: unknown; agree?: unknown } }>(
    '/auth/pictures/:tag/upload',
    { bodyLimit: UPLOAD_LIMIT },
    async (request, reply) => {
      const user = await signedIn(request, reply, true);
      if (!user) return reply;
      const { tag } = request.params;
      if (tag.length > 60) return reply.code(400).send({ error: 'tag too long' });
      if (request.body?.agree !== true) return reply.code(400).send({ error: '請先確認你有權使用這張圖' });
      if ((await uploadsToday(db, user.id)) >= PER_DAY) return reply.code(429).send({ error: `每人每天最多上傳 ${PER_DAY} 張` });
      const raw = typeof request.body?.image === 'string' ? Buffer.from(request.body.image, 'base64') : null;
      if (!raw?.length) return reply.code(400).send({ error: 'image (base64) required' });
      const kind = await pictureKind(db, tag);
      try {
        if (kind === 'avatar') {
          // The size the Commons photos come in (1200px), so the face rules mean the same.
          const photo = await sharp(raw)
            .rotate()
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 92 })
            .toBuffer();
          const job = await queue().add(
            PHOTO_JOB,
            { tag, image: photo.toString('base64'), email: user.email, userId: user.id },
            { jobId: `${PHOTO_JOB}-${user.id}-${Date.now()}`, removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 } },
          );
          return reply.code(202).send({ kind, jobId: job.id });
        }
        const image = await recolourLogo(raw);
        const added = await submitPicture(db, { tag, pictureKind: kind, image, userId: user.id });
        if (added.status === 'approved') refreshPages(uiOrigin, tag);
        return reply.code(201).send({ kind, ...added });
      } catch (err) {
        return reply.code(400).send({ error: `讀不了這張圖：${(err as Error).message}` });
      }
    },
  );

  // A reader's own photo job; admins may look at any.
  app.get<{ Params: { id: string } }>('/auth/pictures/jobs/:id', async (request, reply) => {
    const user = await signedIn(request, reply);
    if (!user) return reply;
    if (!request.params.id.startsWith(`${PHOTO_JOB}-`)) return reply.code(404).send({ error: 'no such job' });
    const job = await queue().getJob(request.params.id);
    if (!job || (user.role !== 'admin' && (job.data as { userId?: number }).userId !== user.id))
      return reply.code(404).send({ error: 'no such job' });
    const result = (job.returnvalue ?? null) as { tag?: string; error?: string; status?: string } | null;
    const state = await job.getState();
    // A finished photo job has published the sketch; refresh the tag's pages once the reader sees it.
    if (state === 'completed' && result?.status === 'approved' && result.tag) refreshPages(uiOrigin, result.tag);
    return { id: job.id, state, result, error: job.failedReason ?? result?.error ?? null };
  });

  // Admins: { rank } locks that candidate in (votes keep counting but do not
  // change it); { rank: null } lets the votes decide again.
  app.put<{ Params: { tag: string }; Body: { rank?: unknown } }>('/auth/pictures/:tag/lock', async (request, reply) => {
    const user = await signedIn(request, reply, true);
    if (!user) return reply;
    if (user.role !== 'admin') return reply.code(403).send({ error: '只有管理員可以鎖定' });
    const { tag } = request.params;
    const rank = request.body?.rank;
    if (rank !== null && !(typeof rank === 'number' && Number.isInteger(rank)))
      return reply.code(400).send({ error: 'rank must be a candidate rank, or null' });
    const kind: PictureKind = await pictureKind(db, tag);
    const at = new Date();
    if (rank === null) {
      if (kind === 'avatar')
        await db
          .update(tagPeople)
          .set({ status: 'voted', reviewedBy: user.email, reviewedAt: at })
          .where(and(eq(tagPeople.tag, tag), sql`${tagPeople.status} <> 'nonhuman'`));
      else await db.update(tagVisuals).set({ status: 'voted', reviewedBy: user.email, reviewedAt: at }).where(eq(tagVisuals.tag, tag));
      const shownRank = await applyVotes(db, tag, kind);
      refreshPages(uiOrigin, tag);
      return { tag, shownRank };
    }
    if (kind === 'avatar') {
      const [c] = await db
        .select({ rank: tagAvatarCandidates.rank })
        .from(tagAvatarCandidates)
        .where(and(eq(tagAvatarCandidates.tag, tag), eq(tagAvatarCandidates.rank, rank)));
      if (!c) return reply.code(404).send({ error: 'no such candidate' });
      await db
        .update(tagPeople)
        .set({ status: 'chosen', shownRank: rank, reviewedBy: user.email, reviewedAt: at })
        .where(and(eq(tagPeople.tag, tag), sql`${tagPeople.status} <> 'nonhuman'`));
    } else {
      const [c] = await db
        .select()
        .from(tagVisualCandidates)
        .where(and(eq(tagVisualCandidates.tag, tag), eq(tagVisualCandidates.rank, rank)));
      if (!c) return reply.code(404).send({ error: 'no such candidate' });
      const { tag: _, rank: __, uploadedBy: ___, uploadedAt: ____, ...picture } = c;
      await db
        .update(tagVisuals)
        .set({ ...picture, status: 'chosen', shownRank: rank, reviewedBy: user.email, reviewedAt: at })
        .where(eq(tagVisuals.tag, tag));
    }
    refreshPages(uiOrigin, tag);
    return { tag, shownRank: rank };
  });
}
