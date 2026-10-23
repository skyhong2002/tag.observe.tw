import names from '../../data/media-names.json' with { type: 'json' };
import trafficHosts from '../../data/media-traffic-hosts.json' with { type: 'json' };
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import { excludedMedia } from '../crawl/registry.ts';
import type { Db } from '../db/client.ts';
import {
  type ExternalBudget,
  externalAllowance,
  externalBudget,
  externalUsedToday,
  recentlyRefused,
  runExternalRequests,
} from '../media-traffic/external.ts';
import { saveTrafficHistory } from '../media-traffic/history.ts';
import { readLiveTraffic, refreshTraffic, trafficDomain, writeLiveTraffic } from '../media-traffic/live.ts';
import { syncFromService, type TrafficService, trafficService } from '../media-traffic/service.ts';

/**
 * Publisher domains for Similarweb and Radar: the GeneHong-mapped catalog plus
 * every reviewed outlet in media-names.json, so outlets the sheet never listed
 * (經濟日報 on money.udn.com, 科技新報…) are fetched too, as are the article hosts
 * in media-traffic-hosts.json. Discovery sources, removed outlets and retired
 * domains are left out. Per outlet, since one outlet can publish on several
 * domains (traffic.observe.tw's site tags are keyed by domain, site-tags.ts).
 */
export const publisherDomainsByMedia = () => {
  const skip = (media: string) => excludedMedia.has(media) || ['google_news', 'dongtaiwang'].includes(media);
  // An outlet measured on a parent domain (tvbs.com.tw) does not also list its own news.* subdomain.
  const overrides: Record<string, { host: string }> = trafficHosts.hosts;
  const under = (media: string, url?: string) => {
    const parent = overrides[media]?.host;
    const domain = url && trafficDomain(url);
    return Boolean(parent && domain && domain.endsWith(`.${parent}`));
  };
  const urls: Array<[string, string | undefined]> = [
    ...catalog.sources
      .filter((source) => !under(source.media, source.websiteUrl))
      .map((source) => [source.media, source.websiteUrl] as [string, string | undefined]),
    ...Object.entries(names.media)
      .filter(
        ([media, entry]) => ['verified', 'retained'].includes(entry.status) && !under(media, (entry as { sourceUrl?: string }).sourceUrl),
      )
      .map(([media, entry]) => [media, (entry as { sourceUrl?: string }).sourceUrl] as [string, string | undefined]),
    ...Object.entries(trafficHosts.hosts).map(([media, entry]) => [media, entry.host] as [string, string | undefined]),
  ];
  const out = new Map<string, string[]>();
  for (const [media, url] of urls) {
    const domain = url && trafficDomain(url);
    if (skip(media) || !domain) continue;
    const list = out.get(media) ?? [];
    if (!list.includes(domain)) out.set(media, [...list, domain]);
  }
  return out;
};
export const publisherDomains = () => [...new Set([...publisherDomainsByMedia().values()].flat())];
/**
 * `db` records every month and profile in the snapshot (history.ts), so
 * nothing Similarweb stops returning is lost. After tag's own outlets, what
 * is left of the run's request budget goes to other services' lookups
 * (external.ts, docs/similarweb-requests.md); none while tag's run was
 * refused, still has outlets due, or a refusal is less than six hours old.
 * With traffic.observe.tw configured (service.ts) tag sends nothing to
 * Similarweb: it registers its outlets there and mirrors the result.
 */
export async function runMediaTrafficJob(
  domains = publisherDomains(),
  db?: Db,
  {
    request = fetch,
    budget = externalBudget(),
    pauseMs = 3000,
    service = trafficService(),
  }: { request?: typeof fetch; budget?: ExternalBudget; pauseMs?: number; service?: TrafficService | null } = {},
) {
  if (service) {
    const { updated, ...result } = await syncFromService(domains, await readLiveTraffic(), service, { request });
    await writeLiveTraffic(result);
    if (db) await saveTrafficHistory(db, result.domains);
    return { via: 'traffic.observe.tw', domains: result.domains.length, updated, status: result.status, checkedAt: result.checkedAt };
  }
  const { updated, remaining, attempted, ...result } = await refreshTraffic(domains, await readLiveTraffic(), { request, pauseMs });
  await writeLiveTraffic(result);
  let external: Awaited<ReturnType<typeof runExternalRequests>> | { skipped: string } = { skipped: 'no database' };
  if (db) {
    await saveTrafficHistory(db, result.domains);
    // A run that was refused or failed outright leaves nothing for others.
    const blocked = result.status === 'blocked' || result.status === 'failed' || (await recentlyRefused(db));
    const allowance = externalAllowance({ attempted, remaining, blocked }, await externalUsedToday(db), budget);
    external = allowance
      ? await runExternalRequests(db, allowance, { request, pauseMs })
      : { skipped: blocked ? 'refused' : 'no budget left' };
  }
  // A rate-limited run that still made progress is expected; the next hourly run resumes.
  if (!updated && result.status !== 'ok') throw Error(result.error || 'No Similarweb traffic available');
  return { domains: result.domains.length, updated, remaining, status: result.status, checkedAt: result.checkedAt, external };
}
