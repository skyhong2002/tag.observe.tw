import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import names from '../../data/media-names.json' with { type: 'json' };
import { publisherDomainsByMedia } from '../jobs/media-traffic-job.ts';
import { trafficDomain } from './live.ts';
import { type TrafficService, trafficService } from './service.ts';

// Media tags (新聞、科技、財經…) come from traffic.observe.tw, where every
// observe site's site tags are kept, voted on and managed
// (https://traffic.observe.tw/site/<domain>/#tags, editors also at /sites/).
// Tags are keyed by domain, so an outlet carries the visible tags of its own
// domains (tagDomainsByMedia: not the platforms or other outlets it is read
// from). Political lean is not a traffic tag: 藍營／綠營 stay in tag's own
// tables (../media-categories.ts, edited at /admin/media/). traffic reserves
// those words since 2026-10-24; any 藍／綠 tag is still left out here so the
// two never disagree on screen.
//
// Readers are synchronous, so the gateway keeps a snapshot, refreshed every
// minute. A failed refresh keeps the last good snapshot, which is also saved to
// a file so a restart while traffic is down still has it; with neither, media
// simply show no tags (the camp labels and every outlet still show).

export const TRAFFIC_SITE = 'https://traffic.observe.tw';
export const trafficSiteUrl = (domain: string) => `${TRAFFIC_SITE}/site/${encodeURIComponent(domain)}/#tags`;
const POLITICAL_TAGS = new Set(['藍', '綠', '藍營', '綠營', '藍營傾向', '綠營傾向', '藍營傾向媒體', '綠營傾向媒體']);

interface TagItem {
  tag: string;
  visible: boolean;
}
export interface TagSnapshot {
  fetchedAt: string;
  /** domain → visible, non-political tags, in traffic's order. */
  domains: Record<string, string[]>;
}

let snapshot: TagSnapshot | null = null;
let byMedia = new Map<string, string[]>();
/**
 * Platforms that carry other outlets' articles. tag still registers them with
 * traffic.observe.tw for the outlets it reads there (their traffic is measured
 * on them), but their tags describe the platform, so only the platform's own
 * entry (or none) carries them.
 */
export const PLATFORM_DOMAINS: Record<string, { media: string | null; why: string }> = {
  'today.line.me': { media: 'today_line_me', why: 'LINE TODAY 新聞聚合，路透等媒體的文章從這裡收錄' },
  'page.line.me': { media: null, why: 'LINE 官方帳號頁，宜蘭新聞網的收錄入口' },
  'k.sina.cn': { media: null, why: '新浪手機版自媒體帳號頁，中國台灣網的收錄入口' },
  'n.yam.com': { media: 'yam', why: '蕃新聞聚合，三星傳媒的收錄入口' },
  'tw.news.yahoo.com': { media: 'yahoo', why: 'Yahoo 新聞聚合' },
  'msn.com': { media: 'msn', why: 'MSN 新聞聚合' },
};

/**
 * The domains whose tags describe each outlet: its registered domains without
 * platforms (above) and without another outlet's reviewed own domain
 * (media-names.json), e.g. 美洲台灣日報 read from vigormedia.tw or 菱傳媒 from
 * ftvnews.com.tw. Outlets sharing one reviewed domain (BBC, 中天) both keep it.
 * The reviewed domain comes first: it is the one pages link to.
 */
export function tagDomainsByMedia(registered = publisherDomainsByMedia()) {
  const owners = new Map<string, Set<string>>();
  for (const [media, entry] of Object.entries(names.media) as Array<[string, { status?: string; sourceUrl?: string }]>) {
    const domain = ['verified', 'retained'].includes(entry.status ?? '') && entry.sourceUrl ? trafficDomain(entry.sourceUrl) : null;
    if (domain) owners.set(domain, (owners.get(domain) ?? new Set()).add(media));
  }
  return new Map(
    [...registered].map(([media, domains]) => [
      media,
      domains
        .filter((domain) => {
          const platform = PLATFORM_DOMAINS[domain];
          if (platform) return platform.media === media;
          const owned = owners.get(domain);
          return !owned || owned.has(media);
        })
        // The main domain (the reviewed one) first: /media/<media>/ links there.
        .sort((a, b) => Number(!!owners.get(b)?.has(media)) - Number(!!owners.get(a)?.has(media))),
    ]),
  );
}

let domainMap: Map<string, string[]> | null = null;
const domainsByMedia = () => (domainMap ??= tagDomainsByMedia());

export const mediaTagsFile = () => process.env.TAG_MEDIA_TAGS_FILE || join(homedir(), '.local/share/tag-analysis/media-tags.json');

function useSnapshot(next: TagSnapshot | null, domainsOf = domainsByMedia()) {
  snapshot = next;
  byMedia = new Map(
    [...domainsOf].map(([media, domains]) => [media, [...new Set(domains.flatMap((domain) => next?.domains[domain] ?? []))]]),
  );
}

/** The outlet's tags: the union over its domains, without political ones. */
export const mediaTags = (media: string): string[] => byMedia.get(media) ?? [];
/** Domains whose tags the outlet carries, for links to traffic.observe.tw. */
export const mediaTagDomains = (media: string): string[] => domainsByMedia().get(media) ?? [];
/** When the snapshot in use was fetched; null before the first success. */
export const mediaTagsFetchedAt = () => snapshot?.fetchedAt ?? null;

export function tagsFromResponse(body: unknown, at: Date): TagSnapshot {
  const raw = (body as { domains?: unknown })?.domains;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('traffic tags: unexpected response');
  const domains: Record<string, string[]> = {};
  for (const [domain, items] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(items)) continue;
    domains[domain] = [
      ...new Set(
        (items as TagItem[])
          .filter((item) => item && item.visible === true && typeof item.tag === 'string')
          .map((item) => item.tag.trim())
          .filter((tag) => tag && !POLITICAL_TAGS.has(tag)),
      ),
    ];
  }
  return { fetchedAt: at.toISOString(), domains };
}

const CHUNK = 2000; // the service's per-request limit
export async function fetchMediaTags(
  service: TrafficService,
  {
    request = fetch,
    now = new Date(),
    domains = domainsByMedia(),
  }: { request?: typeof fetch; now?: Date; domains?: Map<string, string[]> } = {},
): Promise<TagSnapshot> {
  const all = [...new Set([...domains.values()].flat())];
  const merged: TagSnapshot = { fetchedAt: now.toISOString(), domains: {} };
  for (let i = 0; i < all.length; i += CHUNK) {
    const response = await request(`${service.url}/internal/v1/tags`, {
      method: 'POST',
      headers: { authorization: `Bearer ${service.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ domains: all.slice(i, i + CHUNK) }),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    if (!response.ok) throw Error(`traffic tags: HTTP ${response.status}`);
    Object.assign(merged.domains, tagsFromResponse(await response.json(), now).domains);
  }
  return merged;
}

async function readSaved(file: string): Promise<TagSnapshot | null> {
  try {
    const saved = JSON.parse(await readFile(file, 'utf8')) as TagSnapshot;
    return typeof saved?.fetchedAt === 'string' && saved.domains && typeof saved.domains === 'object' ? saved : null;
  } catch {
    return null;
  }
}
async function save(file: string, data: TagSnapshot) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data)}\n`);
  await rename(tmp, file);
}

/** Refresh now and then every `everyMs`; failures keep the last snapshot. */
export function keepMediaTagsFresh({
  service = trafficService(),
  file = mediaTagsFile(),
  everyMs = 60e3,
  request = fetch,
  warn = (_err: unknown) => {},
}: {
  service?: TrafficService | null;
  file?: string | null;
  everyMs?: number;
  request?: typeof fetch;
  warn?: (err: unknown) => void;
} = {}) {
  let saved: string | null = null;
  const tick = async () => {
    if (!service) return;
    try {
      const next = await fetchMediaTags(service, { request });
      useSnapshot(next);
      const text = JSON.stringify(next.domains);
      if (file && text !== saved) {
        await save(file, next);
        saved = text;
      }
    } catch (err) {
      warn(err);
    }
  };
  // `restored` only reads the saved file, so startup never waits on traffic;
  // `ready` also waits for the first fetch.
  const restored = (async () => {
    const found = file ? await readSaved(file) : null;
    if (found && !snapshot) {
      useSnapshot(found);
      saved = JSON.stringify(found.domains);
    }
  })();
  const ready = restored.then(tick);
  const timer = service ? setInterval(tick, everyMs) : null;
  timer?.unref();
  return { restored, ready, stop: () => timer && clearInterval(timer) };
}

/** Tests only: replace the snapshot. */
export function setMediaTagsForTest(next: TagSnapshot | null, domains?: Map<string, string[]>) {
  domainMap = domains ?? null;
  useSnapshot(next);
}
