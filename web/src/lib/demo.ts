import { API_ORIGIN, fetchMedia, fetchRanking, type MediaInfo, type Ranking } from './api';
import { type CampOutlet, type CampShare, campShareCounts, type DemoCamp } from './camp-share.mts';

export type { CampOutlet, CampShare, DemoCamp } from './camp-share.mts';

import { clipHeadline, headlineTags, selectEventCover, selectEventLead } from './event-presentation.mts';
import { isAllowedImage } from './images';
import { fetchJournalists, type JournalistSummary } from './journalists';
import {
  dayStories,
  dayStoryAsEvent,
  type EventCoverage,
  type EventItem,
  type FeedTopic,
  fetchEventDay,
  fetchEvents,
  fetchTopics,
  threadAsEvent,
} from './pages';
import { fetchSimilarity, type SimilarityData, type SimilarityEdge } from './similarity';
import { updatedAtOf } from './topic-update.mts';

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

export async function mediaStats(): Promise<MediaStatRow[]> {
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
  // Keep the selected outlet's original title and credit together; the cover
  // falls back to another outlet's photo when the lead's is missing, generic
  // or off the image allowlist, as the event table does.
  const cover = selectEventCover(news, lead, isAllowedImage);
  // Prefer tags the headline itself says; when it uses none of them verbatim
  // (宜蘭 for 宜蘭縣), fall back to the event's major tags rather than none.
  const title = clipHeadline(lead.title);
  const matched = headlineTags(title, [...event.major, ...event.tags.map((t) => t.tag)]);
  const tags = matched.length > 0 ? matched : event.major;
  return {
    key: event.relatedEventPk ?? `rank-${event.rank}`,
    href: event.relatedEventPk
      ? `/eve/${event.relatedEventPk}/`
      : `/tag/${encodeURIComponent(tags[0] ?? event.major[0] ?? event.tags[0]?.tag ?? '')}/`,
    title,
    tags,
    image: cover?.image ?? null,
    media: lead.media,
    source: media[lead.media]?.title ?? lead.media,
    coverage: event.coverage ?? null,
    sampleOutlets: new Set(news.map((n) => n.media)).size,
    score: event.score,
    event,
  };
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
  const share = campShareCounts(news, blue, green);
  if (!share) return null;
  const outlets = campOutlets(stats);
  return { ...share, camps: share.camps.map((c) => ({ ...c, outlets: outlets[c.camp] })) };
}

/** The events one camp is barely on, or pushing far harder than usual:
 *  today's event archive's 藍綠溫差 boiled down to a few lines per side. */
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

/** What the similarity graph says today, small enough for a home panel:
 *  who publishes a story first, who follows, who gets cited and who cites. */
export interface GraphOutlet {
  media: string;
  name: string;
  /** Distinct articles in the period. */
  count: number;
  /** The outlet most often on the other end of those links. */
  partner: string | null;
  partnerName: string | null;
}
export interface GraphSummary {
  hours: number;
  outlets: number;
  similarityEdges: number;
  citationEdges: number;
  pairs: number;
  citations: number;
  analyzed: number;
  /** Earliest in a story group that another outlet later matched. */
  earliest: GraphOutlet[];
  /** Matched a story another outlet had published earlier. */
  later: GraphOutlet[];
  /** Credited by name in other outlets' articles. */
  cited: GraphOutlet[];
  /** Credited another outlet by name. */
  citing: GraphOutlet[];
}
const TOP = 5;
export function graphSummary(data: SimilarityData | null): GraphSummary | null {
  if (!data) return null;
  const nodes = new Map(data.nodes.map((n) => [n.id, n]));
  const name = (id: string) => nodes.get(id)?.name ?? id;
  const similarity = data.edges.filter((e) => e.kind === 'similarity');
  const citation = data.edges.filter((e) => e.kind === 'citation');
  // Similarity edges point from the later outlet to its group's earliest;
  // citation edges from the citing outlet to the cited one.
  const tally = (edges: SimilarityEdge[], self: 'source' | 'target') => {
    const other = self === 'source' ? 'target' : 'source';
    const partners = new Map<string, Map<string, number>>();
    for (const e of edges) {
      const counts = partners.get(e[self]) ?? new Map<string, number>();
      counts.set(e[other], (counts.get(e[other]) ?? 0) + e.count);
      partners.set(e[self], counts);
    }
    return (id: string) => [...(partners.get(id) ?? [])].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  };
  const list = (key: 'earliest' | 'later' | 'incoming' | 'outgoing', partnerOf: (id: string) => string | null, externalToo = false) =>
    data.nodes
      .filter((n) => n[key] > 0 && (externalToo || !n.external))
      .sort((x, y) => y[key] - x[key] || y.articles - x.articles)
      .slice(0, TOP)
      .map((n) => {
        const partner = partnerOf(n.id);
        return { media: n.id, name: n.name, count: n[key], partner, partnerName: partner ? name(partner) : null };
      });
  return {
    hours: data.hours ?? 24,
    outlets: data.nodes.filter((n) => !n.external).length,
    similarityEdges: similarity.length,
    citationEdges: citation.length,
    pairs: data.index.pairs,
    citations: data.index.citations,
    analyzed: data.index.analyzed,
    earliest: list(
      'earliest',
      tally(
        similarity.flatMap((edge) => [edge, { ...edge, source: edge.target, target: edge.source }]),
        'target',
      ),
    ),
    later: list(
      'later',
      tally(
        similarity.flatMap((edge) => [edge, { ...edge, source: edge.target, target: edge.source }]),
        'source',
      ),
    ),
    cited: list('incoming', tally(citation, 'target'), true),
    citing: list('outgoing', tally(citation, 'source')),
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
  const [events, day, ranking, media, blue, green] = await Promise.all([
    fetchEvents(24),
    fetchEventDay(),
    fetchRanking('news', 'score', 16, true).catch(() => null),
    fetchMedia().catch((): MediaInfo => ({})),
    fetchRanking('blue', 'score', 1).catch(() => null),
    fetchRanking('green', 'score', 1).catch(() => null),
  ]);
  const unique = [...new Map((events?.events ?? []).map((e) => [e.relatedEventPk ?? `rank-${e.rank}`, e])).values()];
  // 焦點事件 follow the event table's default: today's stories by whole-day
  // weight, falling back to this hour's table before the day has any.
  const today = day ? dayStories(day.threads).map((s, i) => dayStoryAsEvent(s, i + 1)) : [];
  const focus = today.length > 0 ? today : unique;
  const stories = focus
    .slice(0, 12)
    .map((e) => story(e, media))
    .filter((s): s is DemoStory => s !== null);
  return {
    events,
    /** How many stories 焦點事件 draws from, and over what. */
    focus: { count: focus.length, daily: today.length > 0 },
    ranking,
    media,
    stories,
    campShare: campShare(ranking, blue, green),
    // The whole day, not just this hour: a camp's blind spots show up over hours.
    // This hour's events too, so the column is not empty just after midnight.
    gaps: campGaps([
      ...new Map(
        [...(day?.threads ?? []).map((t, i) => threadAsEvent(t, i + 1)), ...unique].map((e) => [e.relatedEventPk ?? `rank-${e.rank}`, e]),
      ).values(),
    ]),
  };
}

// These panels stream independently; a slow graph must not hold up the lead story.
export async function loadHomeJournalists(): Promise<JournalistBrief | null> {
  const data = await fetchJournalists(48, 0.65, 6);
  return data ? { hours: data.hours, totals: data.totals, top: data.journalists.slice(0, 6) } : null;
}

export async function loadHomeGraph() {
  return graphSummary(await similarity());
}

export async function loadHomeTopics() {
  const topics = await fetchTopics(120);
  if (!topics) return null;
  const feed: FeedTopic[] = (topics.feed ?? []).filter((t) => updatedAtOf(t) && t.title);
  return {
    outlets: topics.media.length,
    today: feed.filter((t) => Date.now() - Date.parse(updatedAtOf(t) ?? '') < 86400e3).length,
    latest: feed.filter((t, i) => feed.findIndex((u) => u.media === t.media) === i).slice(0, 5),
  };
}
