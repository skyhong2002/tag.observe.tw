import type { Db } from '../db/client.ts';
import { saveRadarHistory } from '../media-traffic/history.ts';
import { radarToken, readRadar, refreshRadar, writeRadar } from '../media-traffic/radar.ts';
import { publisherDomains } from './media-traffic-job.ts';

/** `db` records every Radar period in the snapshot (history.ts); the snapshot itself keeps only the latest. */
export async function runMediaRadarJob(domains = publisherDomains(), db?: Db) {
  const result = await refreshRadar(domains, await readRadar(), { token: radarToken() });
  await writeRadar(result);
  if (db) await saveRadarHistory(db, result.domains);
  if (result.status !== 'ok')
    throw Error(
      result.error ||
        (result.status === 'unconfigured' ? 'Cloudflare Radar token is not configured' : 'No Cloudflare Radar rankings available'),
    );
  return { domains: result.domains.length, checkedAt: result.checkedAt };
}
