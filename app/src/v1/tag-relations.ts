import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { votingCount } from '../tag-groups/relation-votes.ts';
import { publicRelations, validSemanticTag } from '../tag-groups/semantic.ts';

export function registerSemanticRelations(app: FastifyInstance, db: Db, { count = votingCount } = {}) {
  app.get<{ Params: { tag: string } }>('/api/v1/tags/:tag/relations', async (request, reply) => {
    if (!validSemanticTag(request.params.tag)) return reply.code(400).send({ error: '標籤須為 1–60 字且不含控制字元或前後空白' });
    reply.header('cache-control', 'public, max-age=60');
    // How many candidates readers can vote on at /tag/<tag>/relations/; the
    // relations themselves still answer when that count cannot be had.
    const [view, voting] = await Promise.all([
      publicRelations(db, request.params.tag),
      count(db, request.params.tag).catch((err) => {
        request.log.warn({ err }, 'relation voting count failed');
        return null;
      }),
    ]);
    return { ...view, voting };
  });
}
