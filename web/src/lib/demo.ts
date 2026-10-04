import { API_ORIGIN, fetchMedia, fetchRanking, type MediaInfo, type Ranking } from './api';
import { headlineTags, selectEventLead } from './event-presentation.mts';
import { isAllowedImage } from './images';
import { fetchJournalists, type JournalistSummary } from './journalists';
import { type EventCoverage, type EventItem, type FeedTopic, fetchEvents, fetchTopics } from './pages';
import { fetchSimilarity, type SimilarityData } from './similarity';

export type DemoCamp = 'green' | 'other' | 'blue';
export const DEMO_CAMPS: Array<{ key: DemoCamp; label: string; short: string }> = [
  { key: 'green', label: '綠營傾向', short: '綠' },
  { key: 'other', label: '其他', short: '其他' },
  { key: 'blue', label: '藍營傾向', short: '藍' },
];
export interface DemoStory {
  key: string;
  href: string;
  title: string;
  tags: string[];
  image: string | null;
  media: string;
  source: string;
  /** Outlets and camps on the story, from the event snapshot. */
  coverage: EventCoverage | null;
  sampleOutlets: number;
  score: number;
  /** The event behind the story: movement, rank trail, hours on the table. */
  event: EventItem;
}

async function mediaStats(): Promise<MediaStatRow[]> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as { media: MediaStatRow[] }).media : [];
  } catch {
    return [];
  }
}

function story(event: EventItem, media: MediaInfo): DemoStory | null {
  const news = event.news.filter((n) => n.title.trim());
  const lead = selectEventLead(news, event.major);
  if (!lead) return null;
  // Keep the selected outlet's original title, image and credit together.
  // Prefer tags the headline itself says; when it uses none of them verbatim
  // (宜蘭 for 宜蘭縣), fall back to the event's major tags rather than none.
  const matched = headlineTags(lead.title, [...event.major, ...event.tags.map((t) => t.tag)]);
  const tags = matched.length > 0 ? matched : event.major;
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
    coverage: event.coverage ?? null,
    sampleOutlets: new Set(news.map((n) => n.media)).size,
    score: event.score,
    event,
  };
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

/** The events one camp is barely on, or pushing far harder than usual:
 *  the event table's 藍綠溫差 boiled down to a few lines per side. */
export interface CampGap {
  camp: 'blue' | 'green';
  title: string;
  items: EventItem[];
}
export function campGaps(events: EventItem[], perSide = 3): CampGap[] {
  const pick = (camp: 'blue' | 'green') =>
    events
      .filter((e) => e.coverage && (e.coverage.blindspot.includes(camp === 'blue' ? 'green' : 'blue') || e.coverage.tilt === camp))
      .sort((a, b) => {
        const spot = (e: EventItem) => (e.coverage?.blindspot.length ? 1 : 0);
        return spot(b) - spot(a) || Math.abs(b.coverage?.lean ?? 0) - Math.abs(a.coverage?.lean ?? 0);
      })
      .slice(0, perSide);
  return [
    { camp: 'blue', title: '藍營在推、綠營少報', items: pick('blue') },
    { camp: 'green', title: '綠營在推、藍營少報', items: pick('green') },
  ];
}

/** What the similarity graph says today, small enough for a home panel.
 *  Shares rather than counts, so an outlet that simply publishes a lot (中央社)
 *  does not top every list. */
export interface GraphSummary {
  hours: number;
  outlets: number;
  similarityEdges: number;
  citationEdges: number;
  pairs: number;
  citations: number;
  analyzed: number;
  /** Outlets with the largest share of their own articles closely matching another outlet's. */
  similar: Array<{
    media: string;
    name: string;
    share: number;
    matched: number;
    articles: number;
    partner: string | null;
    partnerName: string | null;
  }>;
  /** Outlets credited most often, as a share of every citation found. */
  cited: Array<{ media: string; name: string; share: number; count: number }>;
}
/** Too few analysed articles make a share meaningless (1 of 2 is 50%). */
const MIN_ARTICLES = 20;
export function graphSummary(data: SimilarityData | null): GraphSummary | null {
  if (!data) return null;
  const nodes = new Map(data.nodes.map((n) => [n.id, n]));
  const name = (id: string) => nodes.get(id)?.name ?? id;
  const similarity = data.edges.filter((e) => e.kind === 'similarity');
  const citation = data.edges.filter((e) => e.kind === 'citation');
  // Story links in either direction: later article → the group's earliest.
  const partners = new Map<string, Map<string, number>>();
  for (const e of similarity)
    for (const [self, other] of [
      [e.source, e.target],
      [e.target, e.source],
    ]) {
      const counts = partners.get(self) ?? new Map<string, number>();
      counts.set(other, (counts.get(other) ?? 0) + e.count);
      partners.set(self, counts);
    }
  const similar = data.nodes
    .filter((n) => n.similar > 0)
    .map(({ id: media, similar: matched }) => {
      const articles = nodes.get(media)?.articles ?? 0;
      const top = [...(partners.get(media) ?? [])].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      return {
        media,
        name: name(media),
        share: articles ? Math.min(1, matched / articles) : 0,
        matched,
        articles,
        partner: top,
        partnerName: top ? name(top) : null,
      };
    })
    .filter((r) => r.articles >= MIN_ARTICLES && !nodes.get(r.media)?.external)
    .sort((x, y) => y.share - x.share || y.matched - x.matched)
    .slice(0, 5);
  const credited = new Map<string, number>();
  for (const e of citation) credited.set(e.target, (credited.get(e.target) ?? 0) + e.count);
  const totalCited = [...credited.values()].reduce((n, v) => n + v, 0);
  const cited = [...credited]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5)
    .map(([media, count]) => ({ media, name: name(media), share: totalCited ? count / totalCited : 0, count }));
  return {
    hours: data.hours ?? 24,
    outlets: data.nodes.filter((n) => !n.external).length,
    similarityEdges: similarity.length,
    citationEdges: citation.length,
    pairs: data.index.pairs,
    citations: data.index.citations,
    analyzed: data.index.analyzed,
    similar,
    cited,
  };
}

async function similarity(): Promise<SimilarityData | null> {
  try {
    return await fetchSimilarity({ hours: 24 }, 0.65);
  } catch {
    return null;
  }
}

export interface JournalistBrief {
  hours: number;
  totals: { journalists: number; articles: number; credited: number };
  top: JournalistSummary[];
}

export async function loadDemo() {
  const [events, ranking, media, blue, green, stats, journalists, topics, graph] = await Promise.all([
    fetchEvents(24),
    fetchRanking('news', 'burst', 16, true).catch(() => null),
    fetchMedia().catch((): MediaInfo => ({})),
    fetchRanking('blue', 'score', 1).catch(() => null),
    fetchRanking('green', 'score', 1).catch(() => null),
    mediaStats(),
    fetchJournalists(48, 0.65, 6),
    fetchTopics(120),
    similarity(),
  ]);
  const unique = [...new Map((events?.events ?? []).map((e) => [e.relatedEventPk ?? `rank-${e.rank}`, e])).values()];
  const stories = unique
    .slice(0, 12)
    .map((e) => story(e, media))
    .filter((s): s is DemoStory => s !== null);
  const feed: FeedTopic[] = (topics?.feed ?? []).filter((t) => !t.backlog && t.title);
  return {
    events,
    ranking,
    media,
    stories,
    campShare: campShare(ranking, blue, green, stats),
    gaps: campGaps(unique),
    journalists: journalists
      ? ({ hours: journalists.hours, totals: journalists.totals, top: journalists.journalists.slice(0, 6) } satisfies JournalistBrief)
      : null,
    topics: topics
      ? {
          outlets: topics.media.length,
          // Topics first seen in the past day; the feed is newest first and long enough to cover one.
          today: feed.filter((t) => t.time && Date.now() - Date.parse(t.time) < 86400e3).length,
          latest: feed.slice(0, 6),
        }
      : null,
    graph: graphSummary(graph),
  };
}
