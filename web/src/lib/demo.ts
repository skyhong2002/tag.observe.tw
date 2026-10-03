import { API_ORIGIN, fetchMedia, fetchRanking, type MediaInfo, type Ranking } from './api';
import { headlineTags, selectEventLead } from './event-presentation.mts';
import { isAllowedImage } from './images';
import { type EventItem, fetchEvents } from './pages';

export type DemoCamp = 'green' | 'other' | 'blue';
export const DEMO_CAMPS: Array<{ key: DemoCamp; label: string; short: string }> = [
  { key: 'green', label: '綠營傾向', short: '綠' },
  { key: 'other', label: '未列藍綠', short: '其他' },
  { key: 'blue', label: '藍營傾向', short: '藍' },
];
export interface DemoCoverage {
  from: string;
  to: string;
  outlets: number;
  articles: number;
  camps: Array<{ camp: DemoCamp; outlets: number; articles: number }>;
}
interface CoverageResponse extends DemoCoverage {
  byOutlet: Array<{ media: string; articles: Array<{ url: string; publishedAt: string }> }>;
}
export interface DemoStory {
  key: string;
  href: string;
  title: string;
  tags: string[];
  image: string | null;
  media: string;
  source: string;
  publishedAt: string | null;
  coverage: DemoCoverage | null;
  sampleOutlets: number;
  score: number;
}

async function mediaStats(): Promise<MediaStatRow[]> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as { media: MediaStatRow[] }).media : [];
  } catch {
    return [];
  }
}

async function coverage(id: string): Promise<CoverageResponse | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/events/threads/${encodeURIComponent(id)}/coverage`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? ((await res.json()) as CoverageResponse) : null;
  } catch {
    return null;
  }
}

function story(event: EventItem, media: MediaInfo, cov: CoverageResponse | null): DemoStory | null {
  const news = event.news.filter((n) => n.title.trim());
  const lead = selectEventLead(news, event.major);
  if (!lead) return null;
  // Keep the selected outlet's original title, image and credit together.
  const tags = headlineTags(lead.title, [...event.major, ...event.tags.map((t) => t.tag)]);
  const article = cov?.byOutlet.find((o) => o.media === lead.media)?.articles.find((a) => a.url === lead.url);
  return {
    key: event.relatedEventPk ?? `rank-${event.rank}`,
    href: event.relatedEventPk
      ? `/eve/${event.relatedEventPk}/`
      : `/tag/${encodeURIComponent(tags[0] ?? event.major[0] ?? event.tags[0]?.tag ?? '')}/`,
    title: lead.title,
    tags,
    image: isAllowedImage(lead.image) ? lead.image : null,
    media: lead.media,
    source: media[lead.media]?.title ?? lead.media,
    publishedAt: article?.publishedAt ?? null,
    coverage: cov ? { from: cov.from, to: cov.to, outlets: cov.outlets, articles: cov.articles, camps: cov.camps } : null,
    sampleOutlets: new Set(news.map((n) => n.media)).size,
    score: event.score,
  };
}

/** Absolute difference in observed blue/green outlet counts, as a share of all observed outlets. */
export function coverageGap(cov: DemoCoverage): number {
  if (cov.outlets < 3) return 0;
  const count = (camp: DemoCamp) => cov.camps.find((c) => c.camp === camp)?.outlets ?? 0;
  return Math.abs(count('blue') - count('green')) / cov.outlets;
}

/** Share of the past 24h of tagged news articles by camp; the ranking snapshots already count them. */
export interface CampOutlet {
  media: string;
  title: string;
  icon: string | null;
  last24h: number;
  active: boolean;
}
export interface CampShare {
  hourStart: string;
  articles: number;
  camps: Array<{ camp: DemoCamp; articles: number; outlets: CampOutlet[] }>;
}
/** The rows of /api/v1/media-stats this needs. */
export interface MediaStatRow {
  media: string;
  title: string;
  icon: string | null;
  category: string | null;
  camp?: DemoCamp;
  last24h: number;
  status: string;
}
/**
 * Outlets behind each segment: every blue/green outlet (inactive ones too, so
 * the lists are complete), and for 未列藍綠 the other news outlets that are
 * crawled, matching the news ranking the counts come from.
 */
export function campOutlets(rows: MediaStatRow[]): Record<DemoCamp, CampOutlet[]> {
  const out: Record<DemoCamp, CampOutlet[]> = { green: [], other: [], blue: [] };
  for (const r of rows) {
    const camp = r.camp ?? 'other';
    if (camp === 'other' && (r.category !== 'news' || r.status === 'disabled')) continue;
    out[camp].push({ media: r.media, title: r.title, icon: r.icon, last24h: r.last24h, active: r.last24h > 0 });
  }
  for (const list of Object.values(out)) list.sort((a, b) => b.last24h - a.last24h || a.media.localeCompare(b.media));
  return out;
}
export function campShare(news: Ranking | null, blue: Ranking | null, green: Ranking | null, stats: MediaStatRow[] = []): CampShare | null {
  if (!news || !blue || !green) return null;
  // Each ranking fetch is cached on its own, so around the hour one may lag;
  // 24h windows an hour apart are close enough, anything older is not.
  const hour = news.snapshot.hourStart;
  const apart = (r: Ranking) => Math.abs(Date.parse(r.snapshot.hourStart) - Date.parse(hour));
  if (
    apart(blue) > 3600e3 ||
    apart(green) > 3600e3 ||
    !news.snapshot.articleCount ||
    blue.snapshot.articleCount === null ||
    green.snapshot.articleCount === null
  )
    return null;
  const b = blue.snapshot.articleCount;
  const g = green.snapshot.articleCount;
  const other = Math.max(0, news.snapshot.articleCount - b - g);
  const outlets = campOutlets(stats);
  return {
    hourStart: hour,
    articles: b + g + other,
    camps: [
      { camp: 'green', articles: g, outlets: outlets.green },
      { camp: 'other', articles: other, outlets: outlets.other },
      { camp: 'blue', articles: b, outlets: outlets.blue },
    ],
  };
}

export async function loadDemo() {
  const [events, ranking, media, blue, green, stats] = await Promise.all([
    fetchEvents(12),
    fetchRanking('news', 'burst', 16).catch(() => null),
    fetchMedia().catch((): MediaInfo => ({})),
    fetchRanking('blue', 'score', 1).catch(() => null),
    fetchRanking('green', 'score', 1).catch(() => null),
    mediaStats(),
  ]);
  const unique = [...new Map((events?.events ?? []).map((e) => [e.relatedEventPk ?? `rank-${e.rank}`, e])).values()];
  const stories: DemoStory[] = [];
  // Bound concurrent coverage queries against the shared database.
  for (let i = 0; i < unique.length; i += 3) {
    const batch = await Promise.all(
      unique.slice(i, i + 3).map(async (e) => story(e, media, e.relatedEventPk ? await coverage(e.relatedEventPk) : null)),
    );
    stories.push(...batch.filter((s): s is DemoStory => s !== null));
  }
  return { events, ranking, stories, campShare: campShare(ranking, blue, green, stats) };
}
