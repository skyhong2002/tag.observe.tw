// Shapes of /api/v1/events, dependency-free so pure .mts modules and the root
// test suite can use them; pages.ts re-exports them.
export interface EventNews {
  id: number | null;
  media: string;
  camp?: Camp;
  title: string;
  url: string;
  image: string | null;
}
export type Camp = 'blue' | 'green' | 'other';
export interface EventCoverage {
  /** Outlets that wrote about the event's major tags in the past 24h, busiest first. */
  outlets: Array<{ media: string; camp: Camp }>;
  articles: number;
  camps: Record<Camp, number>;
  /** Blue/green split of the outlets on the story, 其他 excluded. */
  share: { blue: number; green: number } | null;
  /** log2 of the blue:green outlet ratio against the day's baseline; 0 is usual. */
  lean: number | null;
  /** Camp writing noticeably more than usual. */
  tilt: Camp | null;
  /** Camp that barely reported a story the other camp is on: its readers miss it. */
  blindspot: Camp[];
}
export interface CampBaseline {
  outlets: Record<Camp, number>;
  articles: Record<Camp, number>;
}
export interface EventItem {
  rank: number;
  score: number;
  major: string[];
  tags: { tag: string; burst: number | null }[];
  news: EventNews[];
  relatedEventPk: string | null;
  /** Rank in the previous snapshot; null when the thread is new this hour. */
  prevRank?: number | null;
  /** Hours the thread has been on the table so far. */
  hours?: number | null;
  /** Rank in each of the last 24 snapshot hours (oldest first); null = off the table. */
  rankTrail?: Array<number | null> | null;
  firstTime?: string | null;
  coverage?: EventCoverage;
}
