import { radarToken, readRadar, refreshRadar, writeRadar } from '../media-traffic/radar.ts';
import { publisherDomains } from './media-traffic-job.ts';

export async function runMediaRadarJob(domains = publisherDomains()) {
  const result = await refreshRadar(domains, await readRadar(), { token: radarToken() });
  await writeRadar(result);
  if (result.status !== 'ok')
    throw Error(
      result.error ||
        (result.status === 'unconfigured' ? 'Cloudflare Radar token is not configured' : 'No Cloudflare Radar rankings available'),
    );
  return { domains: result.domains.length, checkedAt: result.checkedAt };
}
