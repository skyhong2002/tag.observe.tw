import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { publicObservation } from '../../../web/src/lib/observation.mts';

export function registerSiteObservation(
  app: FastifyInstance,
  file = process.env.TAG_ANALYTICS_SNAPSHOT ?? join(homedir(), '.local/share/tag-analysis/analytics/public.json'),
) {
  app.get('/api/v1/site-observation', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=60');
    try {
      const data = await readFile(file, 'utf8');
      if (data.length > 100_000) throw Error('Oversized snapshot');
      return { snapshot: publicObservation(JSON.parse(data)) };
    } catch {
      // Never expose filesystem paths, credentials, raw upstream responses or parse errors.
      return { snapshot: null };
    }
  });
}
