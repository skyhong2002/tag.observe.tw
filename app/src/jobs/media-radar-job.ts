import type { Db } from '../db/client.ts';
import { saveRadarHistory } from '../media-traffic/history.ts';
import { radarToken, readRadar, refreshRadar, writeRadar } from '../media-traffic/radar.ts';
import { syncRadarFromService, type TrafficService, trafficService } from '../media-traffic/service.ts';
import { publisherDomains } from './media-traffic-job.ts';

/**
 * `db` records every Radar period in the snapshot (history.ts); the snapshot itself keeps only the latest.
 * With traffic.observe.tw configured, tag calls no Cloudflare API: the service fetches Radar for every
 * watched domain (tag's outlets included) and tag mirrors the latest period per outlet.
 */
export async function runMediaRadarJob(
  domains = publisherDomains(),
  db?: Db,
  { service = trafficService(), request = fetch }: { service?: TrafficService | null; request?: typeof fetch } = {},
) {
  const result = service
    ? await syncRadarFromService(domains, await readRadar(), service, { request })
    : await refreshRadar(domains, await readRadar(), { token: radarToken() });
  await writeRadar(result);
  if (db) await saveRadarHistory(db, result.domains);
  if (result.status !== 'ok')
    throw Error(
      result.error ||
        (result.status === 'unconfigured' ? 'Cloudflare Radar token is not configured' : 'No Cloudflare Radar rankings available'),
    );
  return { ...(service ? { via: 'traffic.observe.tw' } : {}), domains: result.domains.length, checkedAt: result.checkedAt };
}
