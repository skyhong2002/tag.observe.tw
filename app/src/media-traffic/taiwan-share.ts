import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import type { SessionUser } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { mediaTaiwanShareLog, mediaTaiwanShares } from '../db/schema.ts';

// Similarweb's Taiwan share is a whole-domain estimate and sometimes plainly
// wrong for our purpose: msn.com is global, a small site can come back as 100%
// Taiwan. Admins correct it per outlet on /media/traffic/ (docs/media-traffic.md);
// the correction replaces Similarweb's figure for every month until cleared,
// and drives the estimated Taiwan readers (visits × share).

export type TaiwanShareOverride = { share: number; note: string; updatedAt: string };
type Options = {
  requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  origin: string;
};

const NOTE_MAX = 255;
const outlets = new Set(catalog.sources.map((source) => source.media));

export async function loadTaiwanShares(db: Db): Promise<Record<string, TaiwanShareOverride>> {
  const rows = await db.select().from(mediaTaiwanShares);
  return Object.fromEntries(rows.map((row) => [row.media, { share: row.share, note: row.note, updatedAt: row.updatedAt.toISOString() }]));
}

/** A share is 0 < share ≤ 1, kept to four decimals (0.01%); null clears the correction. */
export function parseShare(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) return undefined;
  return Math.round(value * 10_000) / 10_000;
}

/** Admin reads and writes; the public read is GET /api/v1/media-taiwan-shares (v1/media-traffic-comparison.ts). */
export function registerTaiwanShares(app: FastifyInstance, db: Db, { requireAdmin, origin }: Options) {
  app.get<{ Params: { media: string } }>('/auth/admin/media/:media/taiwan-share', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const { media } = request.params;
    if (!outlets.has(media)) return reply.code(404).send({ error: 'unknown media' });
    const log = await db
      .select()
      .from(mediaTaiwanShareLog)
      .where(eq(mediaTaiwanShareLog.media, media))
      .orderBy(desc(mediaTaiwanShareLog.id))
      .limit(20);
    return { media, override: (await loadTaiwanShares(db))[media] ?? null, log };
  });

  app.put<{ Params: { media: string }; Body: { share?: unknown; note?: unknown } }>(
    '/auth/admin/media/:media/taiwan-share',
    async (request, reply) => {
      if (request.headers.origin !== origin) {
        reply.header('cache-control', 'no-store').code(403).send({ error: 'same-origin requests only' });
        return reply;
      }
      const user = await requireAdmin(request, reply);
      if (!user) return reply;
      const { media } = request.params;
      if (!outlets.has(media)) return reply.code(404).send({ error: 'unknown media' });
      const share = parseShare(request.body?.share);
      if (share === undefined) return reply.code(400).send({ error: 'share must be a number above 0 and at most 1, or null to clear' });
      const note = typeof request.body?.note === 'string' ? request.body.note.trim() : '';
      if (share !== null && !note) return reply.code(400).send({ error: 'note: say why the Similarweb figure is replaced' });
      if (note.length > NOTE_MAX) return reply.code(400).send({ error: `note must be at most ${NOTE_MAX} characters` });
      const at = new Date();
      const [current] = await db.select().from(mediaTaiwanShares).where(eq(mediaTaiwanShares.media, media));
      if (share === null) {
        if (current) await db.delete(mediaTaiwanShares).where(eq(mediaTaiwanShares.media, media));
      } else {
        await db
          .insert(mediaTaiwanShares)
          .values({ media, share, note, email: user.email, updatedAt: at })
          .onDuplicateKeyUpdate({ set: { share, note, email: user.email, updatedAt: at } });
      }
      if (current || share !== null)
        await db.insert(mediaTaiwanShareLog).values({ media, before: current?.share ?? null, after: share, note, email: user.email, at });
      return { media, override: share === null ? null : { share, note, updatedAt: at.toISOString() } };
    },
  );
}
