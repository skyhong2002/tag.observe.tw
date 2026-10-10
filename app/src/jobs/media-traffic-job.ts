import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import { excludedMedia } from '../crawl/registry.ts';
import { readLiveTraffic, refreshTraffic, trafficDomain, writeLiveTraffic } from '../media-traffic/live.ts';

export const publisherDomains = () => [
  ...new Set(
    catalog.sources
      .filter((source) => !excludedMedia.has(source.media) && !['google_news', 'dongtaiwang'].includes(source.media))
      .flatMap((source) => {
        const domain = source.websiteUrl && trafficDomain(source.websiteUrl);
        return domain ? [domain] : [];
      }),
  ),
];
export async function runMediaTrafficJob(domains = publisherDomains()) {
  const { updated, remaining, ...result } = await refreshTraffic(domains, await readLiveTraffic());
  await writeLiveTraffic(result);
  // A rate-limited run that still made progress is expected; the next hourly run resumes.
  if (!updated && result.status !== 'ok') throw Error(result.error || 'No Similarweb traffic available');
  return { domains: result.domains.length, updated, remaining, status: result.status, checkedAt: result.checkedAt };
}
