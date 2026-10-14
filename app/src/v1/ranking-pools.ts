import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/client.ts';
import { type RankingBasis, rankingBasis } from '../jobs/ranking-basis.ts';
import { LIMITS, POLICY_VERSION, PoolUnavailable, parseWindowQuery, type WindowQuery } from '../ranking-pools/core.ts';
import { readPool } from '../ranking-pools/reader.ts';
import { fingerprint, type PoolManifest, PoolStore } from '../ranking-pools/store.ts';

const noiseFilterVersion = fingerprint(
  ['../tag-noise.ts', '../media-tags.ts', '../jobs/tag-qualification.ts'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')),
);
const policyVersion =
  POLICY_VERSION +
  ':' +
  fingerprint(
    ['../jobs/ranking-compute.ts', '../jobs/ranking-basis.ts', '../ranking-pools/core.ts', '../ranking-pools/reader.ts'].map((f) =>
      readFileSync(new URL(f, import.meta.url), 'utf8'),
    ),
  ).slice(0, 16);
const send = (req: FastifyRequest, reply: FastifyReply, value: unknown) => {
  reply.header('vary', 'Accept-Encoding');
  const gzip = String(req.headers['accept-encoding'] ?? '')
    .split(',')
    .some((v) => {
      const [name, ...params] = v.trim().split(';');
      const q = params.find((x) => x.trim().startsWith('q='));
      return name.toLowerCase() === 'gzip' && (q === undefined || Number(q.trim().slice(2)) > 0);
    });
  if (gzip)
    return reply
      .header('content-encoding', 'gzip')
      .type('application/json')
      .send(gzipSync(JSON.stringify(value)));
  return value;
};
export function registerRankingPools(
  app: FastifyInstance,
  db: Db,
  {
    store = new PoolStore(process.env.TAG_RANKING_POOL_DIR ?? path.join(homedir(), 'tag-analysis-private', 'ranking-pools')),
    read = readPool,
    now = () => new Date(),
  } = {},
) {
  const pending = new Map<string, Promise<ReturnType<PoolStore['get']>>>();
  let startedAt = 0,
    startedCount = 0;
  app.get<{ Querystring: Record<string, unknown> }>('/api/v1/ranking-pools', async (req, reply) => {
    let query: WindowQuery;
    try {
      query = parseWindowQuery(req.query, now());
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
    let basis: RankingBasis;
    try {
      basis = rankingBasis(query.category);
    } catch {
      return reply.code(400).send({ error: 'unknown fixed ranking category' });
    }
    if (!basis.media.length) return reply.code(400).send({ error: 'unknown fixed ranking category' });
    const key = fingerprint({ query, basis, noiseFilterVersion, policy: policyVersion });
    const cached = store.cached(key);
    if (cached) return send(req, reply.header('cache-control', 'public, max-age=30'), cached);
    if (Date.parse(query.since) < Date.parse(basis.coverageFrom))
      return reply.code(503).send({
        error: 'ranking pool unavailable',
        available: false,
        incompleteReason: 'window-before-cohort-coverage',
        window: query,
        basis,
        eligibleTotal: null,
        truncated: false,
        checksum: null,
      });
    let job = pending.get(key);
    if (!job) {
      if (pending.size)
        return reply
          .code(429)
          .header('retry-after', '30')
          .send({ error: 'ranking pool producer busy', available: false, incompleteReason: 'producer-busy' });
      const at = now().getTime();
      if (at - startedAt >= 60_000) {
        startedAt = at;
        startedCount = 0;
      }
      if (startedCount >= 2)
        return reply
          .code(429)
          .header('retry-after', '60')
          .send({ error: 'ranking pool producer budget', available: false, incompleteReason: 'producer-budget' });
      startedCount++;
      job = (async () => {
        const result = await read(db, query, basis),
          computedAt = now().toISOString();
        return store.publish(
          key,
          {
            schemaVersion: 'ranking-pool-1',
            policyVersion,
            available: true,
            incompleteReason: null,
            window: { since: query.since, until: query.until, basis: 'published_at', timezone: 'UTC' },
            category: query.category,
            order: query.order,
            gate: query.gate,
            computedAt,
            asOf: result.asOf,
            expiresAt: new Date(Date.parse(computedAt) + 864e5).toISOString(),
            basis,
            upstreamVocabularyId: null,
            noiseFilterVersion,
            qualification: {
              gate: query.gate,
              distinctArticles: true,
              minTwiceMedia: query.gate === 'all' ? 0 : 2,
              minMedia: query.gate === 'all' ? 0 : query.gate === 'early' ? 2 : 3,
              minArticlesAtOneMedia: query.gate === 'broad' ? 3 : 0,
            },
            sourceCoverage: {
              kind: 'stored-own-tagged-articles; not exhaustive publisher coverage',
              collectionCoverageFrom: basis.coverageFrom,
              sourceArticleCount: result.sourceArticleCount,
              firstPublishedAt: result.sourceFirstPublishedAt,
              lastPublishedAt: result.sourceLastPublishedAt,
              candidateTotal: result.candidateTotal,
              elapsedMs: result.elapsedMs,
            },
          },
          result.entries,
        );
      })();
      pending.set(key, job);
    }
    try {
      return send(req, reply.header('cache-control', 'public, max-age=30'), await job);
    } catch (e) {
      return reply.code(503).send({
        error: 'ranking pool unavailable',
        available: false,
        incompleteReason: e instanceof PoolUnavailable ? e.reason : 'snapshot-source-unavailable',
        window: query,
        basis,
        eligibleTotal: null,
        truncated: true,
        checksum: null,
        limits: LIMITS,
      });
    } finally {
      if (pending.get(key) === job) pending.delete(key);
    }
  });
  app.get<{ Params: { snapshotId: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/api/v1/ranking-pools/:snapshotId',
    async (req, reply) => {
      if (Object.keys(req.query).some((k) => !['cursor', 'limit'].includes(k)))
        return reply.code(400).send({ error: 'unsupported query parameter' });
      const limit = req.query.limit === undefined ? 500 : Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 5000) return reply.code(400).send({ error: 'limit must be1..5000' });
      let m: PoolManifest;
      try {
        m = store.get(req.params.snapshotId);
      } catch (e) {
        return reply.code((e as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 400).send({ error: 'snapshot missing or invalid' });
      }
      if (Date.parse(m.expiresAt) <= now().getTime()) return reply.code(409).send({ error: 'snapshot expired; request new pool' });
      let offset = 0;
      if (req.query.cursor !== undefined) {
        try {
          const c = req.query.cursor;
          if (c.length > 512 || !/^[A-Za-z0-9_-]+$/.test(c)) throw Error();
          const bytes = Buffer.from(c, 'base64url');
          if (bytes.toString('base64url') !== c) throw Error();
          const v = JSON.parse(bytes.toString());
          if (v.snapshotId !== m.snapshotId) return reply.code(409).send({ error: 'cursor snapshot mismatch' });
          if (
            !Number.isSafeInteger(v.offset) ||
            v.offset < 0 ||
            v.offset > m.eligibleTotal ||
            Object.keys(v).sort().join(',') !== 'offset,snapshotId'
          )
            throw Error();
          offset = v.offset;
        } catch {
          return reply.code(400).send({ error: 'invalid cursor' });
        }
      }
      try {
        const entries = store.page(m, offset, limit),
          next = offset + entries.length;
        reply.header(
          'cache-control',
          'public, max-age=' + Math.max(0, Math.min(60, Math.floor((Date.parse(m.expiresAt) - now().getTime()) / 1000))),
        );
        return send(req, reply, {
          ...m,
          offset,
          limit,
          totalPages: Math.ceil(m.eligibleTotal / limit),
          entries,
          nextCursor:
            next < m.eligibleTotal ? Buffer.from(JSON.stringify({ snapshotId: m.snapshotId, offset: next })).toString('base64url') : null,
        });
      } catch {
        return reply
          .code(503)
          .send({ error: 'ranking pool page unreadable', available: false, incompleteReason: 'snapshot-page-unreadable' });
      }
    },
  );
}
