import names from '../../data/media-names.json' with { type: 'json' };
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import { excludedMedia } from '../crawl/registry.ts';
import { readLiveTraffic, refreshTraffic, trafficDomain, writeLiveTraffic } from '../media-traffic/live.ts';

/**
 * Publisher domains for Similarweb and Radar: the GeneHong-mapped catalog plus
 * every reviewed outlet in media-names.json, so outlets the sheet never listed
 * (經濟日報 on money.udn.com, 科技新報…) are fetched too. Discovery sources,
 * removed outlets and retired domains are left out.
 */
export const publisherDomains = () => {
  const skip = (media: string) => excludedMedia.has(media) || ['google_news', 'dongtaiwang'].includes(media);
  const urls = [
    ...catalog.sources.filter((source) => !skip(source.media)).map((source) => source.websiteUrl),
    ...Object.entries(names.media)
      .filter(([media, entry]) => !skip(media) && ['verified', 'retained'].includes(entry.status))
      .map(([, entry]) => (entry as { sourceUrl?: string }).sourceUrl),
  ];
  return [...new Set(urls.flatMap((url) => (url && trafficDomain(url)) || []))];
};
export async function runMediaTrafficJob(domains = publisherDomains()) {
  const { updated, remaining, ...result } = await refreshTraffic(domains, await readLiveTraffic());
  await writeLiveTraffic(result);
  // A rate-limited run that still made progress is expected; the next hourly run resumes.
  if (!updated && result.status !== 'ok') throw Error(result.error || 'No Similarweb traffic available');
  return { domains: result.domains.length, updated, remaining, status: result.status, checkedAt: result.checkedAt };
}
