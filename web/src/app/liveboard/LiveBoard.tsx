'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMP_FILL, CAMP_LABEL } from '@/components/CampBar';
import { CampDot } from '@/components/EventCampDot';
import { eventHeadline, eventHref, Movement, RankTrail } from '@/components/EventCard';
import MediaIcon from '@/components/MediaIcon';
import { useReaderPresence } from '@/components/ReaderPresence';
import Sparkline from '@/components/Sparkline';
import Wordmark from '@/components/Wordmark';
import type { MediaInfo, RankingEntry } from '@/lib/api';
import { type CompareCoverage, makeComparison } from '@/lib/headline-compare.mts';
import { isAllowedImage } from '@/lib/images';
import {
  advance,
  burstCard,
  type Card,
  cardTags,
  dripDelay,
  enqueue,
  eventCards,
  eventReports,
  fitSlots,
  headlineCard,
  type LiveActivity,
  type LiveArticle,
  type LiveBucket,
  type LiveFeed,
  nextReading,
  placeInSlot,
  rankMoves,
  type Slot,
  seedSlots,
  splitSeed,
  storyCards,
  type ThreadCoverage,
  topicCards,
} from '@/lib/liveboard.mts';
import { createFeedPoller } from '@/lib/liveboard-poll.mts';
import type { Camp, EventItem, EventsSnapshot } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';
import BoardImage from './BoardImage';
import CrawlMarquee from './CrawlMarquee';
import styles from './liveboard.module.css';
import OfflineWordmark from './OfflineWordmark';
import StageCard, {
  CARD_DOT,
  CARD_LABEL,
  clock,
  Go,
  mediaHref,
  preloadCard,
  preloadImage,
  Reporters,
  TagChips,
  tagHref,
} from './StageCards';

export interface MediaTotals {
  today: number;
  last24h: number;
  publishingMedia24h: number;
  activeSources: number;
  statusCounts: Record<string, number>;
}

const SECOND = 1e3;
const FEED_EVERY = 30 * SECOND;
const EVENTS_EVERY = 3 * 60 * SECOND;
const RANKING_EVERY = 2 * 60 * SECOND;
const TOTALS_EVERY = 10 * 60 * SECOND;
// A fresh page every few hours keeps a long-running tab lean and picks up deploys.
const RELOAD_EVERY = 6 * 3600 * SECOND;
const DWELL: Record<Card['kind'], number> = {
  event: 14 * SECOND,
  headline: 18 * SECOND,
  copy: 20 * SECOND,
  topic: 12 * SECOND,
  burst: 16 * SECOND,
};
const COMPARE_PER_ROUND = 3;
// The ticker shows articles once their text has been read, never bare
// headlines. Bodies are fetched in waves, so each wave is let in one article
// at a time, spread over a few minutes, each taking the row that has been up
// longest. The page holds back the newest of its first batch so it is moving
// from the start.
const DRIP_MAX = 40;
const DRIP_HELD = 12;
const DRIP_SPREAD = 5 * 60 * SECOND;
const TICKER_ROW_REM = 3.875;
// The reader shows one article's text at a time.
const READ_EVERY = 10 * SECOND;
const READING_MAX = 40;
// The bottom panel rotates through these.
const PANES = ['counter', 'keywords', 'events', 'day'] as const;
const PANE_LABEL: Record<(typeof PANES)[number], string> = {
  counter: '發稿速度',
  keywords: '竄升關鍵字',
  events: '事件排行',
  day: '發稿量',
};
const KEYWORDS = 20;
// Rank trails draw places below this at the bottom, so one far-off hour does not flatten the rest.
const TRAIL_FLOOR = 30;
const PANE_EVERY = 10 * SECOND;
const HOUR = 3600 * SECOND;
const DAY = 24 * HOUR;
const taipeiMidnight = (at: number) => Math.floor((at + 8 * HOUR) / DAY) * DAY - 8 * HOUR;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(10 * SECOND) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function useEvery(ms: number, run: () => void) {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) latest.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), SECOND);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  const opts = { timeZone: 'Asia/Taipei' } as const;
  return (
    <div className="flex items-center gap-3 tabular-nums">
      <span className="whitespace-nowrap text-base text-zinc-400 short:hidden portrait:hidden">
        <span className="block">{now.toLocaleDateString('zh-TW', { ...opts, year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
        <span className="block">{now.toLocaleDateString('zh-TW', { ...opts, weekday: 'long' })}</span>
      </span>
      <span className="w-[8ch] shrink-0 whitespace-nowrap text-right font-mono text-4xl font-bold short:text-3xl portrait:text-3xl">
        {now.toLocaleTimeString('zh-TW', { ...opts, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  children,
  className = '',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex shrink-0 flex-col ${className}`}>
      <span className="whitespace-nowrap text-xs text-zinc-500">{label}</span>
      <span className="flex items-baseline gap-1 whitespace-nowrap text-2xl font-bold tabular-nums short:text-xl">
        {value}
        {unit && <span className="text-sm font-normal text-zinc-400">{unit}</span>}
        {children}
      </span>
    </div>
  );
}

const CAMPS: Camp[] = ['blue', 'green', 'other'];

/**
 * Stacked per-camp bars, oldest on the left, an eighth of a rem apart. Counts sit on every
 * `valueEvery`-th bar plus the peak and the current one, times run along the
 * bottom ending in 現在, and the caption compares the current bucket with the
 * one before and the window's average. The legend names the camps.
 */
function CampBars({
  buckets,
  label,
  tick,
  current,
  units,
  valueEvery = 1,
  axisEvery = 3,
  compact = false,
}: {
  buckets: LiveBucket[];
  label: string;
  tick: (t: string) => string;
  /** The live count for the last bucket, ahead of the server's figure. */
  current?: number;
  /** Names for the current and previous bucket, e.g. 本小時 / 上小時. */
  units: [string, string];
  valueEvery?: number;
  axisEvery?: number;
  /** No legend or comparison, for a small inset chart. */
  compact?: boolean;
}) {
  const totals = buckets.map((b, i) => (i === buckets.length - 1 && current !== undefined ? current : b.blue + b.green + b.other));
  const max = Math.max(1, ...totals);
  const last = buckets.length - 1;
  const peak = totals.indexOf(max);
  const full = totals.slice(0, last);
  const average = full.length ? Math.round(full.reduce((n, v) => n + v, 0) / full.length) : 0;
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-1">
      <figcaption className="flex items-center gap-3 whitespace-nowrap text-xs text-zinc-500">
        <span className="shrink-0 text-sm font-semibold text-zinc-300">{label}</span>
        {!compact &&
          CAMPS.map((c) => (
            <span key={c} className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-sm ${CAMP_FILL[c]}`} aria-hidden />
              {CAMP_LABEL[c]}
            </span>
          ))}
        {!compact && (
          <span className="ml-auto min-w-0 truncate tabular-nums">
            {units[0]}至今 <b className="text-brand-400">{totals[last]}</b> · {units[1]} <b className="text-zinc-200">{totals[last - 1]}</b>{' '}
            · 平均 <b className="text-zinc-200">{average}</b> · 最高 <b className="text-zinc-200">{max}</b>（{tick(buckets[peak].t)}）
          </span>
        )}
      </figcaption>
      <div className="flex min-h-0 flex-1 items-end gap-[0.125rem]">
        {buckets.map((b, i) => (
          <div
            key={b.t}
            className={`flex h-full min-w-0 flex-1 flex-col justify-end gap-[0.125rem] ${i === last ? styles.pulse : ''}`}
            title={`${tick(b.t)}　${CAMPS.map((c) => `${CAMP_LABEL[c]} ${b[c]}`).join('、')}　共 ${totals[i]} 篇`}
          >
            {(i % valueEvery === 0 || i === peak || i === last) && (
              <span
                className={`text-center text-[0.625rem] leading-none tabular-nums ${i === last ? 'font-bold text-brand-400' : i === peak ? 'text-zinc-200' : 'text-zinc-500'}`}
              >
                {totals[i]}
              </span>
            )}
            {(['other', 'green', 'blue'] as const).map((c) =>
              b[c] ? (
                <span
                  key={c}
                  className={`${CAMP_FILL[c]} transition-[height] duration-1000 ${c === 'other' ? 'rounded-t-[0.25rem]' : ''}`}
                  style={{ height: `${(b[c] / max) * 80}%` }}
                />
              ) : null,
            )}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 gap-[0.125rem] text-[0.625rem] leading-none tabular-nums text-zinc-500" aria-hidden>
        {buckets.map((b, i) => (
          <span
            key={b.t}
            className={`min-w-0 flex-1 overflow-visible whitespace-nowrap text-center ${i === last ? 'font-bold text-brand-400' : ''}`}
          >
            {i === last ? '現在' : i % axisEvery === 0 && last - i >= axisEvery / 2 ? tick(b.t) : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Minutes and seconds until `at`, ticking each second. */
function Countdown({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), SECOND);
    return () => clearInterval(id);
  }, []);
  if (now === null) return null;
  const left = Math.max(0, Math.round((Date.parse(at) - now) / SECOND));
  if (left === 0) return <span className="text-emerald-400">啟動中</span>;
  const m = Math.floor(left / 60);
  return <span className="tabular-nums">{m >= 60 ? clock(at) : `${m}:${String(left % 60).padStart(2, '0')}`}</span>;
}

/** The header's second row: crawl runs scrolling past, then the jobs running and due next. */
function ActivityStrip({ activity }: { activity: LiveActivity }) {
  const crawls = activity.crawls;
  return (
    <div className="flex items-center gap-3 border-t border-zinc-800/70 px-6 py-1 text-sm short:px-4 short:py-0.5 portrait:hidden">
      <span className="shrink-0 text-xs font-semibold text-zinc-500">爬蟲 · 近 10 分鐘 {crawls.length} 次</span>
      <CrawlMarquee crawls={crawls} />
      {activity.running.map((r) => (
        <span key={r.job} className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-900/60 px-1.5 text-xs text-emerald-300">
          <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${styles.pulse}`} aria-hidden />
          {r.job} 執行中
        </span>
      ))}
      <span className="shrink-0 text-xs font-semibold text-zinc-500">接下來</span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-zinc-400">
        {activity.upcoming.slice(0, 4).map((u) => (
          <span key={u.job} className="inline-flex items-center gap-1">
            <span className="text-zinc-200">{u.label}</span>
            <Countdown at={u.at} />
          </span>
        ))}
      </span>
    </div>
  );
}

export default function LiveBoard({
  initialEvents,
  initialRanking,
  media,
  initialFeed,
  initialTotals,
}: {
  initialEvents: EventsSnapshot | null;
  initialRanking: RankingEntry[];
  media: MediaInfo;
  initialFeed: LiveFeed | null;
  initialTotals: MediaTotals | null;
}) {
  const [seed] = useState(() => splitSeed(initialFeed?.reading ?? [], DRIP_HELD));
  const [ranking, setRanking] = useState(initialRanking);
  const [totals, setTotals] = useState(initialTotals);
  const [feed, setFeed] = useState(initialFeed);
  const [slots, setSlots] = useState<Array<Slot | null>>(() => seedSlots(seed.shown, 3));
  const [fresh, setFresh] = useState<number | null>(null);
  const [reading, setReading] = useState<LiveArticle | null>(null);
  const [todayExtra, setTodayExtra] = useState(0);
  const [hourCount, setHourCount] = useState<{ hour: number; base: number; extra: number }>({ hour: 0, base: 0, extra: 0 });
  const [moves, setMoves] = useState(() => rankMoves(null, initialRanking));
  const [rankSerial, setRankSerial] = useState(0);
  const [pane, setPane] = useState(0);
  const [events, setEvents] = useState<EventItem[]>(initialEvents?.events ?? []);
  const presence = useReaderPresence();
  const [online, setOnline] = useState(true);
  const feedPoller = useRef<ReturnType<typeof createFeedPoller<LiveFeed>> | null>(null);
  const [now, setNow] = useState(() => Date.parse(initialFeed?.generatedAt ?? initialEvents?.builtAt ?? '') || 0);
  const [shown, setShown] = useState<{ card: Card; serial: number; replay: boolean } | null>(null);
  const [upcoming, setUpcoming] = useState<Card[]>([]);

  const queue = useRef<Card[]>([]);
  const history = useRef<Card[]>([]);
  const seen = useRef(new Set<string>());
  const cursor = useRef(initialFeed?.cursor ?? { after: null, pairsAfter: null, readAfter: null });
  const eventsRef = useRef<EventItem[]>(initialEvents?.events ?? []);
  const compared = useRef(new Set<string>());
  const [coverage, setCoverage] = useState<ReadonlyMap<string, ThreadCoverage>>(new Map());
  const pending = useRef<LiveArticle[]>(seed.pending);
  const arrivals = useRef(0);
  const tickerList = useRef<HTMLUListElement>(null);
  const rankingRef = useRef(initialRanking);
  const readingList = useRef<LiveArticle[]>(initialFeed?.reading ?? []);
  const readShown = useRef(new Set<number>());
  const knownTopics = useRef(new Set((initialFeed?.topics ?? []).map((t) => `${t.id}:${t.at}`)));

  useEffect(() => {
    const poller = createFeedPoller<LiveFeed>({ connection: setOnline });
    feedPoller.current = poller;
    return () => {
      poller.stop();
      feedPoller.current = null;
    };
  }, []);

  const push = useCallback((cards: Array<Card | null>) => {
    const real = cards.filter((c): c is Card => c !== null);
    if (!real.length) return;
    for (const c of real) preloadCard(c);
    queue.current = enqueue(queue.current, real, seen.current);
    setUpcoming(queue.current);
  }, []);

  // Headline pairs for events that just appeared or moved, a few per round.
  const compare = useCallback(
    async (list: EventItem[]) => {
      const todo = list.filter((e) => e.relatedEventPk && !compared.current.has(e.relatedEventPk)).slice(0, COMPARE_PER_ROUND);
      for (const e of todo) {
        compared.current.add(e.relatedEventPk!);
        const found = await getJson<CompareCoverage & ThreadCoverage>(`/api/v1/events/threads/${e.relatedEventPk}/coverage`);
        if (!found) continue;
        // The event card lists these reports; keep the latest dozen threads.
        setCoverage((m) => new Map([...m, [e.relatedEventPk!, found] as const].slice(-12)));
        for (const r of eventReports(found)) preloadImage(r.image, 'thumb');
        const result = makeComparison(e, found, 'camps') ?? makeComparison(e, found, 'outlets');
        push([headlineCard(e, result, Date.now())]);
      }
    },
    [push],
  );

  // First fill: the top events, their headline pairs and the latest copy stories.
  useEffect(() => {
    const at = Date.now();
    setNow(at);
    // Always dark: a wall screen at night. Not saved, so the rest of the site keeps its own theme.
    document.documentElement.dataset.theme = 'dark';
    push(eventCards(null, eventsRef.current, at));
    push(storyCards(initialFeed?.stories.slice(0, 6) ?? [], at));
    push(topicCards(initialFeed?.topics.slice(0, 3) ?? [], at));
    void compare(eventsRef.current.slice(0, 6));
    const reload = setTimeout(() => location.reload(), RELOAD_EVERY);
    const ticking = setInterval(() => setNow(Date.now()), 30 * SECOND);
    return () => {
      clearTimeout(reload);
      clearInterval(ticking);
    };
  }, [compare, push, initialFeed]);

  // The stage: show a card, wait its dwell, show the next.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let serial = 0;
    const step = () => {
      const next = advance(queue.current, history.current);
      queue.current = next.queue;
      history.current = next.history;
      if (next.card) seen.current.add(next.card.key);
      // Keys only need to outlive the queue; trim the oldest.
      if (seen.current.size > 400) seen.current = new Set([...seen.current].slice(-200));
      setUpcoming(next.queue);
      setShown(next.card ? { card: next.card, serial: ++serial, replay: next.replay } : null);
      timer = setTimeout(step, next.card ? DWELL[next.card.kind] : 3 * SECOND);
    };
    timer = setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, []);

  // The reader: the newest article whose text came in, then the next.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const pick = nextReading(readingList.current, readShown.current);
      if (pick.reset) readShown.current.clear();
      if (pick.article) {
        readShown.current.add(pick.article.id);
        setReading(pick.article);
      }
      timer = setTimeout(step, pick.article ? READ_EVERY : 3 * SECOND);
    };
    step();
    return () => clearTimeout(timer);
  }, []);

  // The current hour's count: the server's figure plus what has dripped in since, never going back.
  const stats = feed?.stats;
  useEffect(() => {
    const current = stats?.hourly24.at(-1);
    if (!current) return;
    const hour = Date.parse(current.t);
    const base = current.blue + current.green + current.other;
    setHourCount((c) => (c.hour === hour ? { hour, base: Math.max(base, c.base + c.extra), extra: 0 } : { hour, base, extra: 0 }));
  }, [stats]);

  const pollFeed = useCallback(async () => {
    const c = cursor.current;
    const query = new URLSearchParams();
    if (c.after) query.set('after', String(c.after));
    if (c.pairsAfter) query.set('pairsAfter', c.pairsAfter);
    if (c.readAfter) query.set('readAfter', c.readAfter);
    const next = await feedPoller.current?.poll(() => getJson<LiveFeed>(`/api/v1/liveboard${query.size ? `?${query}` : ''}`));
    if (!next) return;
    const at = Date.now();
    const seeded = c.after !== null;
    cursor.current = next.cursor;
    setFeed(next);
    setNow(at);
    if (seeded) {
      // Read articles drip into the ticker, oldest first; a backlog keeps only its newest.
      const queued = new Set(pending.current.map((a) => a.id));
      const read = [...next.reading].reverse().filter((a) => !queued.has(a.id));
      pending.current = [...pending.current, ...read].slice(-DRIP_MAX);
      push([burstCard(next.reading, at)]);
      // The totals count inserts, which run ahead of the reading.
      const midnight = taipeiMidnight(at);
      setTodayExtra((n) => n + next.articles.filter((a) => Date.parse(a.publishedAt) >= midnight).length);
      setHourCount((c) => ({ ...c, extra: c.extra + next.articles.filter((a) => Date.parse(a.publishedAt) >= c.hour).length }));
    } else if (next.reading.length) {
      const split = splitSeed(next.reading, DRIP_HELD);
      setSlots((current) => seedSlots(split.shown, current.length));
      pending.current = split.pending;
    }
    if (next.reading.length) {
      const ids = new Set(next.reading.map((a) => a.id));
      readingList.current = [...next.reading, ...readingList.current.filter((a) => !ids.has(a.id))].slice(0, READING_MAX);
      for (const a of next.reading) preloadImage(a.image, 'reader');
    }
    push(storyCards(next.stories, at));
    // Topic updates come back on every poll; only ones not seen before make cards.
    const freshTopics = next.topics.filter((t) => !knownTopics.current.has(`${t.id}:${t.at}`));
    for (const t of freshTopics) knownTopics.current.add(`${t.id}:${t.at}`);
    push(topicCards(freshTopics, at));
  }, [push]);
  useEvery(FEED_EVERY, () => void pollFeed());

  // The ticker: one read article at a time, paced so a wave lasts a few minutes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const article = document.hidden ? undefined : pending.current.shift();
      if (article) {
        setSlots((current) => placeInSlot(current, article, ++arrivals.current)?.slots ?? current);
        setFresh(article.id);
      }
      timer = setTimeout(step, dripDelay(pending.current.length + 1, DRIP_SPREAD));
    };
    timer = setTimeout(step, 1200);
    return () => clearTimeout(timer);
  }, []);
  // As many fixed rows as fit the panel.
  useEffect(() => {
    const list = tickerList.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const capacity = Math.max(2, Math.floor(list.clientHeight / (TICKER_ROW_REM * rem)));
      setSlots((current) => (current.length === capacity ? current : fitSlots(current, capacity)));
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  useEvery(PANE_EVERY, () => setPane((p) => (p + 1) % PANES.length));

  useEvery(EVENTS_EVERY, async () => {
    const next = await getJson<EventsSnapshot>('/api/v1/events?limit=12');
    if (!next?.events.length) return;
    const at = Date.now();
    const cards = eventCards(eventsRef.current, next.events, at);
    eventsRef.current = next.events;
    setEvents(next.events);
    push(cards);
    void compare(cards.flatMap((c) => (c.kind === 'event' ? [c.event] : [])));
  });
  useEvery(RANKING_EVERY, async () => {
    const next = await getJson<{ entries: RankingEntry[] }>(`/api/v1/ranking?category=all&order=burst&limit=${KEYWORDS}&ranks=1`);
    if (!next) return;
    setMoves(rankMoves(rankingRef.current, next.entries));
    rankingRef.current = next.entries;
    setRanking(next.entries);
    setRankSerial((n) => n + 1);
  });
  useEvery(TOTALS_EVERY, async () => {
    const next = await getJson<{ totals: MediaTotals }>('/api/v1/media-stats');
    if (!next) return;
    setTotals(next.totals);
    setTodayExtra(0);
  });

  // Tap anywhere: go full screen and keep the screen awake (both need a gesture).
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const kiosk = useCallback(async (event?: React.MouseEvent) => {
    // Links open their page in a new tab; only bare taps take the screen.
    if (event && (event.target as Element).closest('a')) return;
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    } catch {}
    try {
      const lock = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } })
        .wakeLock;
      if (lock && !wake.current) {
        wake.current = await lock.request('screen');
      }
    } catch {}
  }, []);
  useEffect(() => {
    // The lock drops whenever the page is hidden; take it again on return.
    const back = () => {
      if (document.visibilityState === 'visible' && wake.current) {
        wake.current = null;
        void kiosk();
      }
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [kiosk]);

  const lastHour = stats ? stats.last60m.reduce((n, b) => n + b.blue + b.green + b.other, 0) : null;
  const status = totals?.statusCounts ?? {};
  const onStage = cardTags(shown?.card ?? null);
  const thisHour = hourCount.base + hourCount.extra;

  const paneKey = PANES[pane];

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: kiosk gesture target, no keyboard role
    <div
      data-theme="dark"
      onClick={kiosk}
      className={`fixed inset-0 flex flex-col overflow-hidden bg-zinc-950 text-zinc-100 ${styles.board}`}
    >
      <header className="shrink-0 border-b border-zinc-800">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2 short:gap-4 short:px-4 short:py-1 portrait:gap-4 portrait:px-3">
          <div className="relative flex shrink-0 items-end">
            <Wordmark className={`h-9 w-auto text-zinc-100 short:h-7 ${online ? '' : 'invisible'}`} />
            <span role="status" className="absolute inset-0 flex items-center justify-center text-rose-400">
              {!online && (
                <>
                  <span className="sr-only">離線中嗚嗚嗚</span>
                  <OfflineWordmark />
                </>
              )}
            </span>
          </div>
          <Stat label="今日收錄" value={totals ? (totals.today + todayExtra).toLocaleString() : '—'} unit="篇" />
          <Stat
            label="近 1 小時發稿"
            value={lastHour?.toLocaleString() ?? '—'}
            unit={`篇 · ${stats?.activeMedia1h ?? '—'} 家`}
            className="portrait:hidden"
          />
          <Stat label="24 小時發稿媒體" value={totals?.publishingMedia24h ?? '—'} unit="家" className="portrait:hidden" />
          <Stat label={`${totals?.activeSources ?? '—'} 爬蟲`} value={status.ok ?? '—'} unit="正常" className="portrait:hidden" />
          <Stat
            label={
              <span className="inline-flex items-center gap-1.5">
                此刻在線
                <span
                  role="img"
                  aria-label={presence.status}
                  title={presence.status}
                  className={`h-1.5 w-1.5 rounded-full ${online && presence.counted ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                />
              </span>
            }
            value={
              <a href="/observe/opt-out/" title={presence.status}>
                {presence.count ?? '—'}
              </a>
            }
            unit="人"
            className="portrait:hidden"
          >
            <span title="本站瀏覽量：最近 30 分鐘每分鐘瀏覽次數（GA4）" className="ml-2 h-6 w-20 self-center short:w-12">
              {feed?.visitors && <Sparkline values={feed.visitors.perMinute} color="#f97316" className="h-full w-full" />}
            </span>
          </Stat>
          <div className="ml-auto flex shrink-0 flex-col items-end">
            <Clock />
          </div>
        </div>
        {feed?.activity && <ActivityStrip activity={feed.activity} />}
        <p className="hidden border-t border-zinc-800/70 px-3 py-1 text-center text-sm text-amber-300 portrait:block">
          轉為橫向，可看完整看板：內文、排行與發稿量
        </p>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4 short:gap-2 short:p-2 portrait:flex-col portrait:gap-3 portrait:p-3">
        <div className="flex min-w-0 flex-[1.7] flex-col gap-4">
          <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-zinc-900/60 px-6 pt-6 pb-2 ring-1 ring-zinc-800 short:rounded-2xl short:px-3 short:pt-3 portrait:px-4 portrait:pt-4">
            {shown ? (
              <div key={shown.serial} className={`min-h-0 flex-1 overflow-hidden ${styles.stage} ${styles.stageBox}`}>
                <StageCard card={shown.card} media={media} now={now} coverage={coverage} />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-2xl text-zinc-500">等待新資料…</div>
            )}
            <div className="mt-2 flex shrink-0 items-center gap-3 whitespace-nowrap text-xs text-zinc-500">
              {shown && (
                <span className="h-1 w-40 overflow-hidden rounded-full bg-zinc-800">
                  <span
                    key={shown.serial}
                    className={`block h-full bg-brand-500 ${styles.progress}`}
                    style={{ animationDuration: `${DWELL[shown.card.kind]}ms` }}
                  />
                </span>
              )}
              {shown?.replay && <span>回顧</span>}
              <span className="ml-auto">接下來</span>
              {upcoming.length ? (
                <span className="flex items-center gap-1.5">
                  {upcoming.slice(0, 12).map((c) => (
                    <span key={c.key} className={`h-2.5 w-2.5 rounded-full ${CARD_DOT[c.kind]}`} title={CARD_LABEL[c.kind]} />
                  ))}
                  {upcoming.length > 12 && <span className="tabular-nums">+{upcoming.length - 12}</span>}
                </span>
              ) : (
                <span>無新卡片，輪播最近內容</span>
              )}
              <span className="flex items-center gap-2 border-l border-zinc-800 pl-3 short:hidden portrait:hidden">
                {(Object.keys(CARD_LABEL) as Array<Card['kind']>).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${CARD_DOT[k]}`} aria-hidden />
                    {CARD_LABEL[k]}
                  </span>
                ))}
              </span>
            </div>
          </section>

          <section className="flex h-[17dvh] shrink-0 flex-col short:hidden portrait:hidden gap-1 overflow-hidden rounded-3xl bg-zinc-900/60 px-4 py-2.5 ring-1 ring-zinc-800">
            <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
              {PANES.map((p, i) => (
                <span key={p} className={`inline-flex items-center gap-1 ${i === pane ? 'font-semibold text-zinc-200' : ''}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${i === pane ? 'bg-brand-500' : 'bg-zinc-700'}`} aria-hidden />
                  {PANE_LABEL[p]}
                </span>
              ))}
              {paneKey === 'keywords' && <span className="ml-auto">折線：近 24 小時名次，越高越前 · 亮起：正在播的內容</span>}
            </div>
            <div key={paneKey} className={`flex min-h-0 flex-1 ${styles.fade}`}>
              {paneKey === 'counter' && (
                <div className="flex flex-1 items-stretch gap-8 whitespace-nowrap">
                  {[
                    { label: '本小時已發稿', value: thisHour.toLocaleString(), unit: '篇', hot: true },
                    { label: '平均', value: lastHour ? String(Math.max(1, Math.round(3600 / lastHour))) : '—', unit: '秒一篇' },
                    { label: '在發稿的媒體', value: String(stats?.activeMedia1h ?? '—'), unit: '家' },
                  ].map((m) => (
                    <div key={m.label} className="flex flex-col justify-center gap-1">
                      <span className="text-sm text-zinc-500">{m.label}</span>
                      <span className="flex items-baseline gap-1.5">
                        <span
                          key={m.hot ? m.value : undefined}
                          className={`text-5xl font-bold leading-none tabular-nums ${m.hot ? `text-brand-400 ${styles.pop}` : 'text-zinc-100'}`}
                        >
                          {m.value}
                        </span>
                        <span className="text-base text-zinc-400">{m.unit}</span>
                      </span>
                    </div>
                  ))}
                  {stats && (
                    <div className="flex h-full min-w-0 flex-1">
                      <CampBars
                        buckets={stats.last60m}
                        label="近 1 小時，每 5 分鐘"
                        tick={clock}
                        units={['這 5 分', '前 5 分']}
                        axisEvery={4}
                        compact
                      />
                    </div>
                  )}
                </div>
              )}
              {paneKey === 'keywords' && (
                <ol className="grid flex-1 grid-flow-col grid-cols-5 grid-rows-4 gap-x-2">
                  {ranking.slice(0, KEYWORDS).map((r, i) => {
                    const move = moves.get(r.tag) ?? 0;
                    const lit = onStage.has(r.tag);
                    return (
                      <li
                        key={`${r.tag}:${move === 0 ? 0 : rankSerial}`}
                        className={`flex min-w-0 items-center gap-1.5 rounded-md px-1.5 transition-colors duration-700 ${lit ? 'bg-brand-600/30 ring-1 ring-brand-500' : ''} ${move !== 0 ? styles.flash : ''}`}
                      >
                        <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-500">{i + 1}</span>
                        <Go href={tagHref(r.tag)} className={`truncate text-base font-medium ${lit ? 'text-white' : ''}`}>
                          {r.tag}
                        </Go>
                        {move === 'new' ? (
                          <span className="shrink-0 rounded bg-brand-600 px-1 text-[0.625rem] text-white">進榜</span>
                        ) : move > 0 ? (
                          <span className="shrink-0 text-xs text-emerald-400">↑{move}</span>
                        ) : move < 0 ? (
                          <span className="shrink-0 text-xs text-zinc-500">↓{-move}</span>
                        ) : (
                          r.new && <span className="shrink-0 rounded bg-zinc-700 px-1 text-[0.625rem] text-zinc-200">新</span>
                        )}
                        {r.rankTrail && (
                          <span
                            className="ml-auto shrink-0"
                            title={`近 24 小時竄升名次：${r.rankTrail.map((p) => p.position ?? '—').join('、')}`}
                          >
                            <Sparkline
                              values={r.rankTrail.map((p) => (p.position === null ? null : Math.min(p.position, TRAIL_FLOOR)))}
                              rank
                              dots={false}
                              color="#f97316"
                              className="h-4 w-12"
                            />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {paneKey === 'events' && (
                <ol className="grid flex-1 grid-flow-col grid-cols-2 grid-rows-4 gap-x-4">
                  {events.slice(0, 8).map((e) => {
                    const lit = e.major.some((t) => onStage.has(t));
                    return (
                      <li
                        key={e.relatedEventPk ?? e.rank}
                        className={`flex min-w-0 items-center gap-2 rounded-md px-1.5 ${lit ? 'bg-brand-600/30 ring-1 ring-brand-500' : ''}`}
                      >
                        <span className="w-5 shrink-0 text-right font-bold tabular-nums text-zinc-500">{e.rank}</span>
                        <Go href={eventHref(e)} className="min-w-0 truncate text-base">
                          {eventHeadline(e)}
                        </Go>
                        <Movement e={{ ...e, hours: null }} className="shrink-0" />
                        <span className="ml-auto flex shrink-0 items-center">
                          <RankTrail e={e} className="h-5 w-16" />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              {paneKey === 'day' && stats && (
                <div className="flex min-w-0 flex-1 gap-4">
                  <CampBars
                    buckets={stats.hourly24}
                    label="24 小時，每小時"
                    tick={clock}
                    current={thisHour}
                    units={['本小時', '上小時']}
                    valueEvery={2}
                    axisEvery={3}
                  />
                  <div className="flex w-[32%] min-w-0">
                    <CampBars
                      buckets={stats.last60m}
                      label="近 1 小時，每 5 分鐘"
                      tick={clock}
                      units={['這 5 分', '前 5 分']}
                      axisEvery={3}
                      compact
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="flex w-[32%] min-w-0 flex-col gap-4 short:w-[36%] portrait:h-[36%] portrait:w-full">
          <div className="relative flex min-h-0 flex-[3] flex-col overflow-hidden rounded-3xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800 short:hidden portrait:hidden">
            <h2 className="flex shrink-0 items-center gap-2 text-sm font-semibold text-emerald-400">
              <span className={`h-2 w-2 rounded-full bg-emerald-400 ${styles.pulse}`} aria-hidden />
              剛讀到的內文
            </h2>
            {reading ? (
              <article key={reading.id} className={`mt-2 flex min-h-0 flex-1 flex-col gap-2.5 ${styles.stage}`}>
                <div className="flex shrink-0 items-center gap-2 text-base text-zinc-300">
                  <MediaIcon rem media={reading.media} title={reading.mediaTitle} size={22} />
                  <Go href={mediaHref(reading.media)} className="shrink-0 font-semibold">
                    {reading.mediaTitle}
                  </Go>
                  <CampDot camp={reading.camp} />
                  <span className="ml-auto shrink-0 tabular-nums text-zinc-500">{clock(reading.publishedAt)} 發布</span>
                </div>
                <div className="flex shrink-0 gap-3">
                  {isAllowedImage(reading.image) && (
                    <BoardImage
                      src={reading.image}
                      frameClassName="relative aspect-[4/3] w-[28%] shrink-0 self-start overflow-hidden rounded-lg bg-zinc-800"
                      sizes="12vw"
                      className="object-cover"
                      priority
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Go href={articleHref(reading)} className={`text-[1.15rem] font-bold leading-snug ${styles.clamp3}`}>
                      {reading.title}
                    </Go>
                    <div className="min-w-0 text-base leading-tight">
                      <Reporters article={reading} className="mr-2.5 text-sm text-zinc-400" />
                      <TagChips tags={reading.tags} inline />
                    </div>
                  </div>
                </div>
                <p
                  className={`min-h-0 flex-1 overflow-hidden whitespace-pre-line text-[0.95rem] text-zinc-200 ${styles.fadeOut} ${styles.paragraphs}`}
                >
                  {reading.text}
                </p>
                <span className="h-0.5 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                  <span className={`block h-full bg-emerald-500 ${styles.progress}`} style={{ animationDuration: `${READ_EVERY}ms` }} />
                </span>
              </article>
            ) : (
              <div className="flex flex-1 items-center justify-center text-zinc-500">等待內文…</div>
            )}
          </div>
          <div className="flex min-h-0 flex-[2] flex-col overflow-hidden rounded-3xl bg-zinc-900/60 ring-1 ring-zinc-800 short:rounded-2xl">
            <h2 className="flex items-center gap-2 px-4 pt-2.5 text-sm font-semibold text-zinc-400 short:px-3 short:pt-2">
              新進新聞
              <span className="ml-auto font-normal tabular-nums text-zinc-500">
                {stats ? `24 小時 ${stats.total24h.toLocaleString()} 篇` : ''}
              </span>
            </h2>
            <ul
              ref={tickerList}
              className="grid min-h-0 flex-1 overflow-hidden px-4 short:px-3"
              style={{ gridTemplateRows: `repeat(${slots.length}, minmax(0, 1fr))` }}
            >
              {slots.map((slot, i) => {
                const a = slot?.article;
                return (
                  <li key={a?.id ?? `empty:${i}`} className="min-h-0 overflow-hidden border-b border-zinc-800/80 last:border-b-0">
                    {a && (
                      <div key={a.id} className={`flex h-full flex-col justify-center gap-1 py-1 ${fresh === a.id ? styles.enter : ''}`}>
                        <div className="flex min-w-0 items-baseline gap-2">
                          <Go href={articleHref(a)} className="min-w-0 flex-1 truncate text-[1.05rem] font-medium leading-snug">
                            {a.title}
                          </Go>
                          <span className="shrink-0 text-sm tabular-nums text-zinc-400">
                            {a.datePending ? '待確認' : clock(a.publishedAt)}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-400">
                          <MediaIcon rem media={a.media} title={a.mediaTitle} size={16} />
                          <Go href={mediaHref(a.media)} className="shrink-0">
                            {a.mediaTitle}
                          </Go>
                          <CampDot camp={a.camp} />
                          {(a.authors.length > 0 || !!a.attributions?.length) && (
                            <Reporters article={a} className="max-w-[45%] shrink-0 truncate leading-tight" />
                          )}
                          {fresh === a.id && (
                            <span className="shrink-0 rounded bg-brand-600 px-1 text-[0.6875rem] font-bold text-white">剛進</span>
                          )}
                          <TagChips tags={a.tags} max={4} compact className="text-sm" />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
