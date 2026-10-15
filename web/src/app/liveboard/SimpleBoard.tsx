'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReaderPresence } from '@/components/ReaderPresence';
import Wordmark from '@/components/Wordmark';
import type { RankingEntry } from '@/lib/api';
import { type CloudSizes, type PlacedWord, pictureBox } from '@/lib/word-cloud.mts';
import { layoutCloud } from './cloud-layout';
import { campColour, type Spread, spreadCamps, spreadX } from './compare.mts';
import SceneView from './SceneView';
import { EVENT_FRAMES, type LiveScenes, type SceneEvent, type SceneRow, stayOf } from './scenes';
import { type CloudLens, cloudLens, type Lens, type LiveboardSettings, pickLenses } from './settings';
import styles from './simple.module.css';

// The simple liveboard: the whole screen is the home page's cloud, the lens's
// name in the middle and the keywords packed around it; the wordmark sits in
// the corner. A lens (what is rising, what the blue-leaning or green-leaning
// outlets write about, …) plays its last few hourly snapshots forward to now:
// each word that stays drifts slowly as it grows or shrinks, staying near its
// place; words that drop out shrink away and new ones grow in. Then the next
// lens cross-fades in over the last. Tapping a word opens its tag page.
// 藍綠對照 plays two camps' rankings on one spectrum under the centre: each
// word sits left (green) or right (blue) by how much more that camp writes
// it, its colour drifting from green through ink to blue the same way.
// Other lenses are scenes (SceneView): the top events one a frame, or a
// leaderboard of the day's topics, from /api/v1/liveboard/scenes.
// ↑ / ↓ (or PageUp / PageDown, as a presenter remote sends), a swipe up or
// down, or the ‹ › beside the time line step to the previous or next hour,
// and past either end to the neighbouring lens; ← / → or a sideways swipe go
// straight to the previous or next lens; tapping an hour goes to it.
// Settings: settings.ts, /liveboard/setting/.

const SECOND = 1000;
const HOUR = 3600 * SECOND;
/** Keywords fetched per snapshot: enough for the largest `words` setting. */
const WORDS = 80;
/** The present snapshot is fetched again after this long; past ones never change. */
const STALE = 2 * 60 * SECOND;
/** How long a word takes to shrink away (keep in step with .word's transitions). */
const LEAVE = 3200;
/** Words are drawn at this size and scaled, so a change of size animates with the move. */
const BASE = 40;
/** How long a scene's frame takes to fade in (keep in step with scenes.module.css). */
const SCENE_FADE = 1000;

export type Pictures = Record<string, { image?: string; emoji?: string; aspect?: number }>;
interface Term {
  tag: string;
  weight: number;
  /** Its articles in the ranking's window, for 藍綠對照's share of voice. */
  count?: number;
}
/** One hourly snapshot of a cloud lens, or one frame of a scene (its terms empty). */
interface Frame {
  id: number;
  computedAt: string;
  terms: Term[];
  /** Hours before now it was asked for (0 is the present); set when a lens's frames are gathered. */
  back?: number;
  /** A compare lens's words on the spectrum (compare.mts)… */
  camps?: Spread[];
  /** …an event lens's event… */
  event?: SceneEvent;
  /** …or a leaderboard's rows. */
  rows?: SceneRow[];
}
interface RankingResponse {
  snapshot: { id: number; computedAt: string };
  entries: RankingEntry[];
}

const rankingUrl = (lens: CloudLens, at?: Date) =>
  `/api/v1/ranking?category=${lens.category}&order=${lens.order}&limit=${WORDS + 8}${lens.order === 'growth' ? '&gate=all' : ''}${at ? `&at=${encodeURIComponent(at.toISOString())}` : ''}`;

function frameOf(lens: CloudLens, ranking: RankingResponse): Frame {
  const weight = (e: RankingEntry) =>
    lens.order === 'growth' ? (e.signals?.growth ?? 0) : lens.order === 'burst' ? (e.burst ?? 0) : e.normalized;
  const terms = ranking.entries
    .map((e) => ({ tag: e.tag, weight: weight(e), count: e.count }))
    .filter((t) => t.weight > 0)
    .slice(0, WORDS);
  return { id: ranking.snapshot.id, computedAt: ranking.snapshot.computedAt, terms };
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(10 * SECOND) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Canvas units for a screen of this shape: 1200 across in landscape, 420 in portrait, at 100%. */
function canvasFor(px: { width: number; height: number }, scale: number) {
  const portrait = px.height > px.width * 1.1;
  // A smaller scale lays out on a wider canvas, so every word and the centre come out smaller.
  const width = Math.round(((portrait ? 420 : 1200) * 100) / scale);
  const height = Math.round((width * px.height) / Math.max(1, px.width));
  const short = Math.min(width, height);
  const sizes: CloudSizes = {
    min: portrait ? 12 : 16,
    max: portrait ? 40 : Math.round(Math.min(84, short / 7)),
    floor: portrait ? 10 : 13,
    budget: 0.62,
    curve: 0.85,
    gap: portrait ? 8 : 14,
    markGap: portrait ? 12 : 24,
    irregular: 0.2,
    scatter: portrait ? 900 : 2400,
  };
  return { width, height, title: Math.round(portrait ? 30 : Math.min(64, short * 0.09)), sizes };
}

/** Width of a line of text in font sizes (CJK one each, Latin a little over half). */
const ems = (text: string) => Array.from(text).reduce((n, c) => n + (/[^\u0000-\u00ff]/.test(c) ? 1 : 0.6), 0);
/** The lens's name, note and hour line in the middle of the cloud, and the box the words keep clear of. */
function centreOf(lens: Lens, hours: string[], title: number, room: number) {
  const note = Math.round(title * 0.4);
  // The time line, one slot per step, each with its own stretch of the progress bar under it;
  // smaller type when many long labels would not fit across.
  const natural = ems(hours.join('')) + 1.4 * hours.length;
  const hour = Math.min(Math.round(title * 0.36), (room * 0.9) / Math.max(1, natural));
  const gap = hour * 1.4;
  let x = 0;
  const slots = hours.map((label) => {
    const width = ems(label) * hour + gap;
    const slot = { label, x, width };
    x += width;
    return slot;
  });
  const line = x;
  for (const slot of slots) slot.x -= line / 2;
  // The ‹ › that skip a frame flank the time line, or the name when there is only the present.
  const timeline = hours.length > 1;
  // No smaller than a fingertip on a phone, where the hour labels shrink to fit across.
  const arrow = timeline ? Math.max(hour * 1.6, title * 0.6) : title * 0.7;
  const arrows = {
    size: arrow,
    x: (timeline ? line / 2 : (ems(lens.title) * title * 1.04) / 2) + arrow * 0.9,
    y: timeline ? title * 1.3 + note * 1.7 + hour * 0.85 : title * 0.62,
  };
  const width = Math.max(ems(lens.title) * title * 1.04, ems(lens.note) * note, 2 * arrows.x + arrow * 1.2) + title * 0.6;
  const height = title * 1.3 + note * 1.7 + (timeline ? hour * 2.9 : 0);
  return { title, note, hour, slots, arrows, width, height, clear: [{ x: -width / 2, y: -height / 2, width, height }] };
}

interface Badge {
  text: string;
  up: boolean;
  /** Smaller type for a wide label (New), so its pill stays about as wide as the others. */
  small?: boolean;
}
/** Room a change badge takes beside a word or a picture's name, in font sizes of that text. */
const BADGE_ROOM = 1.3;
/** Each word's change from the previous step: its place (▲3 / ▼2) or score (+12% / −8%); New when it was not ranked. */
function badgesFor(change: LiveboardSettings['change'], terms: Term[], before: Term[] | undefined) {
  const out = new Map<string, Badge>();
  if (change === 'off' || !before) return out;
  const was = new Map(before.map((t, i) => [t.tag, { rank: i, weight: t.weight }]));
  for (const [rank, t] of terms.entries()) {
    const prev = was.get(t.tag);
    if (!prev) out.set(t.tag, { text: 'New', up: true, small: true });
    else if (change === 'rank') {
      const moved = prev.rank - rank;
      if (moved) out.set(t.tag, { text: `${moved > 0 ? '▲' : '▼'}${Math.abs(moved)}`, up: moved > 0 });
    } else {
      const pct = prev.weight ? ((t.weight - prev.weight) / prev.weight) * 100 : 0;
      if (Math.abs(pct) >= 1) out.set(t.tag, { text: `${pct > 0 ? '+' : '−'}${Math.round(Math.abs(pct))}%`, up: pct > 0 });
    }
  }
  return out;
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "6 小時前", or in days once it is whole days. */
const ago = (hours: number) => (hours % 24 ? `${hours} 小時前` : `${hours / 24} 天前`);

type Phase = 'enter' | 'live' | 'exit';
interface Shown extends PlacedWord {
  /** The element's key: a word that has to move far leaves as one element and arrives as another. */
  key: string;
  /** Its lens, whose colour it keeps while it fades out under the next one. */
  lens: Lens;
  phase: Phase;
  /** Enters or leaves by fading alone, without growing or shrinking (a change of lens). */
  fade?: boolean;
  /** How far it moved or grew in the latest change, in canvas units; settling waits longer for more. */
  moved?: number;
  /** Its change since the previous step, drawn beside it once the step has settled. */
  badge?: Badge;
  /** On a compare lens, blue's share of it (0 only green, 1 only blue), for its colour. */
  blue?: number;
}
/** When a newcomer starts appearing, in seconds after the change: on a new lens soon and close
 *  together; on a new hour once the words that stay have mostly moved. Word and settleMs share it. */
const enterDelay = (fade: boolean | undefined, index: number) => (fade ? 0.4 + (index % 12) * 0.06 : 1 + (index % 12) * 0.08);
/** Share of an eased transition after which the eye sees no more change: a word travelling or
 *  resizing is watched for most of it; a newcomer only grows from a small size, so it looks
 *  done sooner still (measured: the stay then starts within ~0.3 s of the last visible change). */
const SEEN = { move: 0.65, grow: 0.42 };
/** How long until the words look settled, in ms, so an hour's stay starts counting then rather than
 *  at the very end of the eased tails (keep in step with Word's transitions and .word). */
function settleMs(words: Shown[], first = false) {
  if (first) return 1.8 * SEEN.grow * SECOND;
  let end = 0;
  words.forEach((w, i) => {
    const seconds =
      w.phase === 'enter'
        ? enterDelay(w.fade, i) + (w.fade ? 1 : 3) * SEEN.grow
        : w.phase === 'exit'
          ? (w.fade ? 1.2 : 1.8) * SEEN.grow
          : // A nudge of a few units looks done long before the 3 s are up; a long move takes most of it.
            w.moved
            ? Math.min(3 * SEEN.move, 0.6 + w.moved / 40)
            : 0;
    end = Math.max(end, seconds);
  });
  return end * SECOND;
}
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** A cloud to lay out in `rect`; on a compare lens, each word held to its place on the spectrum. */
interface Job {
  spread?: Map<string, number>;
  lens: Lens;
  terms: Term[];
  badges: Map<string, Badge>;
  rect: Rect;
  clear?: Array<{ x: number; y: number; width: number; height: number }>;
  words: number;
}
type Laid = PlacedWord & { job: Job };
/** A word that would travel further than this share of the canvas width fades out and in instead. */
const FAR = 0.25;
/** A drag at least this long (px), and mostly along one axis, is a swipe (see onPointerUp). */
const SWIPE = 50;
/** What is on screen: a lens, its frames, and which frame is showing. `run` changes with every lens. */
interface Playing {
  run: number;
  lens: Lens;
  frames: Frame[];
  frame: number;
  /** Changes with every frame shown, a frame skipped back to included: its animation settles under `run:visit`. */
  visit: number;
}
interface Skip {
  step: (by: number) => void;
  to: (frame: number) => void;
  lens: (by: number) => void;
}
const STILL: Skip = { step: () => {}, to: () => {}, lens: () => {} };
/** A place a skip goes to: a lens and its frame (`last` is its present, however many frames it turns out to have). */
interface Spot {
  lens: number;
  frame: number | 'last';
}

/** Whether the site's dark theme is on: <html data-theme>, set by the root layout and ThemeSync. */
function useDarkTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.dataset.theme === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 10 * SECOND);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  const parts = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return (
    <span className="tabular-nums">
      {get('month')}/{get('day')}（{get('weekday').replace('週', '')}） {get('hour')}:{get('minute')}
    </span>
  );
}

export default function SimpleBoard({
  initial,
  pictures: allPictures,
  today: initialToday,
  settings,
}: {
  /** A lens's present ranking, fetched with the page. */
  initial: { lens: string; ranking: RankingResponse } | null;
  pictures: Pictures;
  /** Articles collected today (/api/v1/media-stats), refreshed every two minutes. */
  today: number | null;
  settings: LiveboardSettings;
}) {
  const presence = useReaderPresence();
  const [today, setToday] = useState(initialToday);
  useEffect(() => {
    const id = setInterval(
      async () => {
        if (document.hidden) return;
        const stats = await getJson<{ totals: { today: number } }>('/api/v1/media-stats');
        if (stats) setToday(stats.totals.today);
      },
      2 * 60 * SECOND,
    );
    return () => clearInterval(id);
  }, []);
  const lenses = useMemo(() => pickLenses(settings.lenses), [settings.lenses]);
  const dark = useDarkTheme();
  const tint = (lens: Lens) => (dark ? lens.dark : lens.accent);
  /** A compare lens's three anchor colours: its green side, its ink for the even middle, its blue side. */
  const spectrumOf = (lens: Lens) => {
    if (lens.scene !== 'compare') return null;
    const [g, b] = lens.sides.map(cloudLens);
    return g && b ? { green: tint(g), ink: tint(lens), blue: tint(b) } : null;
  };
  /** A word's colour: its lens's, or on a compare lens its place between the two camps'. */
  const colourOf = (w: Shown) => {
    const sp = w.blue === undefined ? null : spectrumOf(w.lens);
    return sp && w.blue !== undefined ? campColour(w.blue, sp.green, sp.ink, sp.blue) : tint(w.lens);
  };
  const pictures = settings.pictures ? allPictures : NO_PICTURES;
  const frame = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState<{ width: number; height: number } | null>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [words, setWords] = useState<Shown[]>([]);
  const cache = useRef(new Map<string, { at: number; frame: Frame | null }>());
  /** The event and topic scenes' data, shared by their lenses and fetched again once stale. */
  const scenes = useRef<{ at: number; data: Promise<LiveScenes | null> } | null>(null);
  /** Skips to the next (1) or previous (-1) frame or lens, or to one frame of the lens; set by the player. */
  const skip = useRef<Skip>(STILL);
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    const lens = lenses.find((l): l is CloudLens => l.key === initial?.lens && l.scene === 'cloud');
    if (lens && initial?.ranking.entries.length)
      cache.current.set(`${lens.key}@now`, { at: Date.now(), frame: frameOf(lens, initial.ranking) });
  }

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setPx((old) => (old && Math.abs(old.width - width) < 2 && Math.abs(old.height - height) < 2 ? old : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Plays the lenses in turn: fetch a lens's frames (the next one is fetched
  // while the present one holds), cross-fade to the oldest frame, step forward
  // to now, hold, and go on. A skip cuts whatever it is waiting on short: a
  // step goes to the neighbouring frame, past either end to the neighbouring
  // lens (its oldest frame going forward, its present going back).
  useEffect(() => {
    let cancelled = false;
    /** Where a skip asked to go, until the player takes it up. */
    let wanted: Spot | null = null;
    /** Where the board is: the lens on screen (or being fetched), its frame and how many it has. */
    let here = { lens: 0, frame: 0, frames: 0 };
    let index = 0;
    let next: Promise<Frame[]>;
    let wake: () => void = () => {};
    /** Waits for `promise`, or less should the board be skipped or closed meanwhile. */
    const until = <T,>(promise: Promise<T>) =>
      Promise.race([promise, new Promise<undefined>((resolve) => (wake = () => resolve(undefined)))]);
    const sleep = (ms: number) => {
      let id: ReturnType<typeof setTimeout> | undefined;
      return until(new Promise<void>((resolve) => (id = setTimeout(resolve, ms)))).finally(() => clearTimeout(id));
    };
    const wrap = (lens: number) => ((lens % lenses.length) + lenses.length) % lenses.length;
    const go = (spot: Spot) => {
      wanted = spot;
      wake();
    };
    skip.current = {
      step: (by) => {
        if (!lenses.length) return;
        // From a lens still being fetched (or not yet played) a step goes on to the next lens.
        const from = wanted ?? here;
        const frame = from.lens === here.lens && from.frame !== 'last' ? from.frame + by : by > 0 ? Infinity : -1;
        if (from.lens === here.lens && frame >= 0 && frame < here.frames) go({ lens: here.lens, frame });
        else go(by > 0 ? { lens: wrap(from.lens + 1), frame: 0 } : { lens: wrap(from.lens - 1), frame: 'last' });
      },
      to: (frame) => {
        if (frame !== here.frame || wanted) go({ lens: here.lens, frame });
      },
      lens: (by) => {
        if (lenses.length) go({ lens: wrap((wanted ?? here).lens + by), frame: 0 });
      },
    };
    const snapshot = async (lens: CloudLens, hoursBack: number, now: number) => {
      // Past snapshots are filed under their hour, so a later turn reuses them.
      const key = hoursBack ? `${lens.key}@${Math.floor((now - hoursBack * HOUR) / HOUR)}` : `${lens.key}@now`;
      const hit = cache.current.get(key);
      if (hit && (hoursBack || Date.now() - hit.at < STALE)) return hit.frame;
      const ranking = await getJson<RankingResponse>(rankingUrl(lens, hoursBack ? new Date(now - hoursBack * HOUR) : undefined));
      const got = ranking?.entries.length ? frameOf(lens, ranking) : null;
      if (got || !hit) cache.current.set(key, { at: Date.now(), frame: got });
      return got ?? hit?.frame ?? null;
    };
    const sceneData = () => {
      if (!scenes.current || Date.now() - scenes.current.at > STALE / 2) {
        const data = getJson<LiveScenes>('/api/v1/liveboard/scenes');
        scenes.current = { at: Date.now(), data };
        // A failed fetch is tried again on the next turn.
        data.then((d) => {
          if (!d && scenes.current?.data === data) scenes.current = null;
        });
      }
      return scenes.current.data;
    };
    const framesOf = async (lens: Lens): Promise<Frame[]> => {
      if (lens.scene === 'compare') return compareFrames(lens.sides);
      if (lens.scene !== 'cloud') {
        const data = await sceneData();
        if (!data) return [];
        const at = data.generatedAt;
        if (lens.scene === 'events')
          return data.events.slice(0, EVENT_FRAMES).map((event, i) => ({ id: i, computedAt: at, terms: [], event }));
        const rows = data.boards[lens.board];
        return rows.length ? [{ id: 0, computedAt: at, terms: [], rows }] : [];
      }
      const now = Date.now();
      const all = await Promise.all(
        Array.from({ length: settings.history + 1 }, async (_, i): Promise<Frame | null> => {
          const back = (settings.history - i) * settings.interval;
          const f = await snapshot(lens, back, now);
          return f && { ...f, back };
        }),
      );
      // Oldest first, one per snapshot, words only.
      return all.filter((f, i): f is Frame => !!f?.terms.length && all.findIndex((g) => g?.id === f.id) === i);
    };
    // Both camps' snapshots for each step, on one spectrum (compare.mts).
    const compareFrames = async ([leftKey, rightKey]: [string, string]): Promise<Frame[]> => {
      const left = cloudLens(leftKey);
      const right = cloudLens(rightKey);
      if (!left || !right) return [];
      const now = Date.now();
      const all = await Promise.all(
        Array.from({ length: settings.history + 1 }, async (_, i): Promise<Frame | null> => {
          const back = (settings.history - i) * settings.interval;
          const [a, b] = await Promise.all([snapshot(left, back, now), snapshot(right, back, now)]);
          if (!a?.terms.length || !b?.terms.length) return null;
          const spread = spreadCamps(a.terms, b.terms, settings.words);
          return {
            id: a.id * 1_000_003 + b.id,
            computedAt: a.computedAt > b.computedAt ? a.computedAt : b.computedAt,
            terms: spread.map(({ tag, weight }) => ({ tag, weight })),
            back,
            camps: spread,
          };
        }),
      );
      return all.filter((f, i): f is Frame => !!f?.terms.length && all.findIndex((g) => g?.id === f.id) === i);
    };
    // Resolves once a frame's animation is over (or after 15 s, should its layout never come).
    const settled = (key: string) =>
      settledFrames.current.has(key)
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const id = setTimeout(resolve, 15 * SECOND);
            settleWaiters.current.set(key, () => {
              clearTimeout(id);
              resolve();
            });
          });
    /** Takes up a skip to another lens: it is the one to fetch and play next, from the frame asked for. */
    let start: Spot['frame'] = 0;
    const toLens = () => {
      if (!wanted) return;
      index = here.lens = wanted.lens;
      start = wanted.frame;
      wanted = null;
      next = framesOf(lenses[index]);
    };
    const play = async () => {
      let run = 0;
      let visit = 0;
      next = framesOf(lenses[0]);
      let empty = 0;
      while (!cancelled) {
        const lens = lenses[index];
        here = { lens: index, frame: 0, frames: 0 };
        const frames = await until(next);
        if (cancelled) return;
        if (wanted && wanted.lens === index) {
          start = wanted.frame;
          wanted = null;
        }
        if (wanted || !frames) {
          toLens();
          continue;
        }
        const after = (index + 1) % lenses.length;
        if (!frames.length) {
          // Nothing for this lens (or the API is down): try the next, resting after a full round.
          index = after;
          start = 0;
          next = framesOf(lenses[index]);
          if (++empty >= lenses.length) {
            empty = 0;
            await sleep(30 * SECOND);
            if (cancelled) return;
            toLens();
          }
          continue;
        }
        empty = 0;
        run += 1;
        let f = start === 'last' ? frames.length - 1 : Math.min(start, frames.length - 1);
        start = 0;
        visit += 1;
        setPlaying({ run, lens, frames, frame: f, visit });
        const show = (frame: number) => {
          const v = ++visit;
          setPlaying((p) => (p && p.run === run ? { ...p, frame, visit: v } : p));
        };
        // Each frame: let the animation finish, then stay `step` seconds (`hold` for the present).
        // A skip within the lens goes to the frame asked for; one to another lens ends the turn.
        const skipped = () => {
          if (!wanted || wanted.lens !== index) return !!wanted;
          f = wanted.frame === 'last' ? frames.length - 1 : wanted.frame;
          wanted = null;
          show(f);
          return false;
        };
        for (;;) {
          here = { lens: index, frame: f, frames: frames.length };
          const shown = f;
          await until(settled(`${run}:${visit}`));
          if (cancelled) return;
          if (skipped()) break;
          if (f !== shown) continue;
          const last = f === frames.length - 1;
          if (last) next = framesOf(lenses[after]);
          await sleep(stayOf(lens.scene, last, settings) * SECOND);
          if (cancelled) return;
          if (skipped()) break;
          if (f !== shown) continue;
          if (last) break;
          f += 1;
          show(f);
        }
        if (wanted) toLens();
        else index = after;
      }
    };
    if (lenses.length) play();
    return () => {
      cancelled = true;
      skip.current = STILL;
      wake();
    };
  }, [lenses, settings.history, settings.interval, settings.step, settings.hold, settings.words]);

  // The keys: ↑ ↓ step through the hours (an event lens's events), on past
  // either end; ← → go to the previous or next lens. A presenter remote's two
  // keys (PageUp / PageDown) step, so they still reach every lens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const step = e.key === 'ArrowDown' || e.key === 'PageDown' ? 1 : e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 0;
      const lens = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step && !lens) return;
      e.preventDefault();
      if (step) skip.current.step(step);
      else skip.current.lens(lens);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // A swipe as the keys: sideways for the next lens (right to left) or the previous,
  // up or down for the next hour (bottom to top) or the previous. The click that
  // ends a swipe over a word must not open it.
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.isPrimary) swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiped.current = false;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= SWIPE && Math.abs(dx) >= 1.5 * Math.abs(dy)) skip.current.lens(dx < 0 ? 1 : -1);
    else if (Math.abs(dy) >= SWIPE && Math.abs(dy) >= 1.5 * Math.abs(dx)) skip.current.step(dy < 0 ? 1 : -1);
    else return;
    swiped.current = true;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swiped.current) return;
    swiped.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const canvas = useMemo(() => (px ? canvasFor(px, settings.scale) : null), [px, settings.scale]);
  const shownWords = useRef(words);
  shownWords.current = words;
  const serial = useRef(0);
  /** The run (lens turn) the words on screen were laid out for. */
  const laidRun = useRef(0);
  // Frames (`run:frame`) whose animation has finished, so their stay may start counting; the
  // player waits on these, and the progress bar fills only from then.
  const [settledFrame, setSettledFrame] = useState<string | null>(null);
  const settledFrames = useRef(new Set<string>());
  const settleWaiters = useRef(new Map<string, () => void>());
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settleAfter = (key: string, ms: number) => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (settledFrames.current.size > 50) settledFrames.current.clear();
      settledFrames.current.add(key);
      setSettledFrame(key);
      settleWaiters.current.get(key)?.();
      settleWaiters.current.delete(key);
    }, ms);
  };

  // Each frame is the snapshot that stood that many hours ago (the hour's last one).
  // An event lens's frames are its events, by rank.
  const hourLabels = useMemo(
    () =>
      (playing?.frames ?? []).map((f, i, all) => (f.event ? String(f.event.rank) : i === all.length - 1 || !f.back ? '現在' : ago(f.back))),
    [playing?.frames],
  );
  const cloudy = playing?.lens.scene === 'cloud' || playing?.lens.scene === 'compare';
  const centre = useMemo(
    () =>
      canvas && playing && cloudy
        ? // A compare lens's centre is a band over the spectrum: smaller, so the words get the height.
          centreOf(
            playing.lens,
            hourLabels,
            playing.lens.scene === 'compare' ? Math.round(canvas.title * 0.62) : canvas.title,
            canvas.width,
          )
        : null,
    [canvas, playing?.lens, cloudy, hourLabels],
  );
  const spectrum = playing ? spectrumOf(playing.lens) : null;
  // A compare lens puts its centre in a band on top, the spectrum under it and its axis at the foot.
  const band = useMemo(() => {
    if (!canvas || !centre || playing?.lens.scene !== 'compare') return null;
    const top = centre.height + canvas.title * 0.5;
    const axis = canvas.title * 0.9;
    return { x: 0, y: top, width: canvas.width, height: Math.max(0, canvas.height - top - axis), axis };
  }, [canvas, centre, playing?.lens]);

  // A scene has no words: the cloud's fade out where they are, and the scene's
  // frame counts as settled once it has faded in.
  useEffect(() => {
    if (!playing || playing.lens.scene === 'cloud' || playing.lens.scene === 'compare') return;
    laidRun.current = playing.run;
    setWords((ws) =>
      ws.some((w) => w.phase !== 'exit')
        ? ws.flatMap((w): Shown[] => (w.phase === 'enter' ? [] : [{ ...w, phase: 'exit', fade: true }]))
        : ws,
    );
    settleAfter(`${playing.run}:${playing.visit}`, SCENE_FADE);
  }, [playing]);

  // Lays the frame out around the centre and hands out phases. A new hour of
  // the same lens keeps each word near where it was: words still there move
  // and resize, new ones grow in, gone ones shrink away. A new lens only
  // fades: the old words fade out where they are and the new lens's words
  // fade in just after, so the screen is never empty and the two clouds
  // barely overlap. Words keep their order in the list, newcomers at the
  // end: moving an element in the DOM would cut its transition short and
  // make it jump.
  useEffect(() => {
    if (!canvas || !playing || !centre) return;
    const frame = playing.frames[playing.frame];
    const previous = playing.frames[playing.frame - 1];
    const room = settings.change === 'off' ? 0 : BADGE_ROOM;
    const newLens = laidRun.current !== 0 && laidRun.current !== playing.run;
    const before = shownWords.current.filter((w) => w.phase !== 'exit');
    // What to lay out where: the whole canvas round the centre, or a compare
    // lens's spectrum under it, each word held to its blue share across.
    const lens = playing.lens;
    const camps = frame.camps;
    const job: Job =
      lens.scene === 'compare' && camps && band
        ? {
            spread: new Map(camps.map((t) => [t.tag, t.blue])),
            lens,
            terms: frame.terms,
            badges: badgesFor(settings.change, frame.terms, previous?.terms),
            rect: band,
            words: settings.words,
          }
        : {
            lens,
            terms: frame.terms,
            badges: badgesFor(settings.change, frame.terms, previous?.terms),
            rect: { x: 0, y: 0, width: canvas.width, height: canvas.height },
            clear: centre.clear,
            words: settings.words,
          };
    const jobs = [job];
    let live = true;
    Promise.all(
      jobs.map((job) => {
        // On the spectrum a word's x is its blue share, found up or down from the middle line
        // (a step sideways costs as much as `stretch` up or down), and left out rather than
        // placed where its x would be wrong; elsewhere it stays near where it was.
        const reach = job.rect.width * 0.1;
        const anchors = job.spread
          ? new Map(
              [...job.spread].map(([label, blue]) => [
                label,
                { x: spreadX(blue, job.rect.width, job.rect.width * 0.07), y: job.rect.height / 2 },
              ]),
            )
          : before.length && !newLens
            ? new Map(before.map((w) => [w.label, { x: w.x + w.width / 2 - job.rect.x, y: w.y + w.height / 2 - job.rect.y }]))
            : undefined;
        return layoutCloud(
          job.terms.slice(0, job.words).map((t) => {
            const p = pictures[t.tag];
            return {
              label: t.tag,
              count: t.weight,
              square: !!(p?.image || p?.emoji),
              aspect: p?.image ? p.aspect : undefined,
              extra: room,
            };
          }),
          job.rect.width,
          job.rect.height,
          {
            ...canvas.sizes,
            // The spectrum is shorter than the whole canvas.
            max: job.spread ? Math.round(canvas.sizes.max * 0.85) : canvas.sizes.max,
            words: job.words,
            clear: job.clear,
            anchors,
            ...(job.spread ? { anchorOnly: true, anchorReach: reach, anchorStretch: job.rect.height / 2 / reach } : {}),
          },
        ).then((placed) => placed.map((w): Laid => ({ ...w, x: w.x + job.rect.x, y: w.y + job.rect.y, job })));
      }),
    )
      .then((laid) => laid.flat())
      .then((placed) => {
        if (!live || !placed.length) return;
        laidRun.current = playing.run;
        const old = shownWords.current;
        const kept = old.filter((w) => w.phase !== 'exit');
        const fresh = !kept.length;
        const shown = ({ job, ...w }: Laid, phase: Phase, key = `${w.label}~${++serial.current}`): Shown => ({
          ...w,
          key,
          lens: job.lens,
          blue: job.spread?.get(w.label),
          phase,
          badge: job.badges.get(w.label),
        });
        const frameKey = `${playing.run}:${playing.visit}`;
        if (fresh && !newLens) {
          setWords(placed.map((w) => shown(w, 'live')));
          settleAfter(frameKey, settleMs([], true));
        } else if (newLens) {
          const leaving = old.flatMap((w): Shown[] => (w.phase === 'enter' ? [] : [{ ...w, phase: 'exit', fade: true }]));
          const all = [...leaving, ...placed.map((w) => ({ ...shown(w, 'enter'), fade: true }))];
          setWords(all);
          settleAfter(frameKey, settleMs(all));
        } else {
          const at = new Map(placed.map((w) => [w.label, w]));
          const showing = new Set(kept.map((w) => w.label));
          const done = new Set<string>();
          const far = canvas.width * FAR;
          const arrivals: Shown[] = [];
          const next = old.flatMap((w): Shown[] => {
            const now = at.get(w.label);
            if (w.phase === 'exit') {
              // A word coming back grows in where it now belongs (it is invisible on the way).
              if (!now || showing.has(w.label) || done.has(w.label)) return [w];
              done.add(w.label);
              return [shown(now, 'enter', w.key)];
            }
            if (!now) return w.phase === 'live' ? [{ ...w, phase: 'exit', fade: false }] : [];
            done.add(w.label);
            const distance = Math.hypot(now.x + now.width / 2 - (w.x + w.width / 2), now.y + now.height / 2 - (w.y + w.height / 2));
            if (distance > far) {
              arrivals.push(shown(now, 'enter'));
              return [{ ...w, phase: 'exit', fade: false }];
            }
            const moved = Math.max(
              Math.abs(now.x - w.x),
              Math.abs(now.y - w.y),
              Math.abs(now.width - w.width),
              Math.abs(now.height - w.height),
            );
            return [{ ...shown(now, w.phase, w.key), moved }];
          });
          // Newcomers go at the end so no element already drawn moves in the DOM.
          const all = [...next, ...arrivals, ...placed.filter((w) => !done.has(w.label)).map((w) => shown(w, 'enter'))];
          setWords(all);
          settleAfter(frameKey, settleMs(all));
        }
      });
    return () => {
      live = false;
    };
  }, [canvas, playing, pictures, centre, band, settings.words, settings.change]);

  // Newcomers mount small and clear, then turn live on the next frames so they
  // grow in; the leavers are dropped once they have shrunk away.
  useEffect(() => {
    if (!words.some((w) => w.phase === 'enter' || w.phase === 'exit')) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setWords((ws) => ws.map((w) => (w.phase === 'enter' ? { ...w, phase: 'live' } : w))));
    });
    return () => cancelAnimationFrame(raf);
  }, [words]);
  const leaving = words.some((w) => w.phase === 'exit');
  useEffect(() => {
    if (!leaving) return;
    const drop = setTimeout(() => setWords((ws) => ws.filter((w) => w.phase !== 'exit')), LEAVE);
    return () => clearTimeout(drop);
  }, [leaving]);

  const lens = playing?.lens ?? lenses[0];
  const updated = playing?.frames.at(-1)?.computedAt;
  return (
    <main className={styles.board} style={{ '--ui': settings.scale / 100 } as React.CSSProperties}>
      <header className={styles.header}>
        {/* The wordmark leads to the board's settings. */}
        <Link prefetch={false} href="/liveboard/setting/" className={styles.brand} aria-label="即時看板設定">
          <Wordmark className={styles.wordmark} />
          <span>同一件事，各家怎麼說</span>
        </Link>
        <div className={styles.side}>
          {/* As on the full board: who is reading now, the day's articles, and when this lens was last ranked. */}
          <div className={styles.stats}>
            <span title={presence.status}>
              <span className={styles.live} data-on={presence.counted || undefined} aria-hidden />
              此刻在線 <b>{presence.count ?? '—'}</b> 人
            </span>
            <span className={styles.wide}>
              今日收錄 <b>{today?.toLocaleString() ?? '—'}</b> 篇
            </span>
            {updated && (
              <span>
                排行更新 <b>{hhmm(updated)}</b>
              </span>
            )}
            <Clock />
          </div>
          <div className={styles.dots} aria-hidden>
            {lenses.map((l) => (
              <span key={l.key} style={l.key === lens?.key ? { background: tint(lens), width: 18 } : undefined} />
            ))}
          </div>
        </div>
      </header>
      <div
        ref={frame}
        className={styles.frame}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
        onClickCapture={onClickCapture}
      >
        {playing && (playing.lens.scene === 'events' || playing.lens.scene === 'board') && (
          <SceneView
            key={playing.run}
            lens={playing.lens}
            colour={tint(playing.lens)}
            event={playing.frames[playing.frame]?.event}
            rows={playing.frames[playing.frame]?.rows}
            frame={playing.frame}
            labels={hourLabels}
            settled={settledFrame === `${playing.run}:${playing.visit}`}
            stay={stayOf(playing.lens.scene, playing.frame === playing.frames.length - 1, settings)}
            onStep={(by) => skip.current.step(by)}
            onTo={(i) => skip.current.to(i)}
          />
        )}
        {canvas && (
          <svg
            viewBox={`0 0 ${canvas.width} ${canvas.height}`}
            className={styles.cloud}
            aria-label={lens?.scene === 'cloud' || lens?.scene === 'compare' ? `${lens.title}文字雲` : undefined}
            aria-hidden={lens?.scene === 'cloud' || lens?.scene === 'compare' ? undefined : true}
          >
            {playing && centre && (
              <g
                key={`centre-${playing.run}`}
                className={styles.fadeIn}
                // A compare lens's centre heads its band on top; a cloud's sits in its middle.
                transform={`translate(${canvas.width / 2} ${band ? canvas.title * 0.25 : canvas.height / 2 - centre.height / 2})`}
              >
                <text
                  y={centre.title * 1.0}
                  fontSize={centre.title}
                  textAnchor="middle"
                  fontWeight={700}
                  fill={tint(playing.lens)}
                  letterSpacing="0.04em"
                >
                  {playing.lens.title}
                </text>
                <text y={centre.title * 1.3 + centre.note * 1.25} fontSize={centre.note} textAnchor="middle" className={styles.note}>
                  {playing.lens.note}
                </text>
                {centre.slots.length > 1 && (
                  <g transform={`translate(0 ${centre.title * 1.3 + centre.note * 1.7})`} className={styles.hours}>
                    {centre.slots.map((slot, i) => {
                      const now = i === playing.frame;
                      const bar = {
                        x: slot.x + centre.hour * 0.35,
                        width: slot.width - centre.hour * 0.7,
                        y: centre.hour * 2.05,
                        height: centre.hour * 0.22,
                      };
                      return (
                        <Hit
                          key={slot.label}
                          label={`跳到${slot.label}`}
                          onHit={() => skip.current.to(i)}
                          box={{ x: slot.x, y: 0, width: slot.width, height: centre.hour * 2.6 }}
                        >
                          <text
                            x={slot.x + slot.width / 2}
                            y={centre.hour * 1.3}
                            fontSize={centre.hour}
                            textAnchor="middle"
                            fill={now ? tint(playing.lens) : undefined}
                            fontWeight={now ? 700 : 400}
                          >
                            {slot.label}
                          </text>
                          <rect {...bar} rx={bar.height / 2} className={styles.track} opacity={i > playing.frame ? 0.45 : 1} />
                          {i < playing.frame && <rect {...bar} rx={bar.height / 2} fill={tint(playing.lens)} opacity={0.35} />}
                          {now && settledFrame === `${playing.run}:${playing.visit}` && (
                            // Fills over the time this hour (or the present) stays, once its animation is over.
                            <rect
                              key={`${playing.run}-${i}`}
                              {...bar}
                              rx={bar.height / 2}
                              fill={tint(playing.lens)}
                              className={styles.fill}
                              style={{ animationDuration: `${i === centre.slots.length - 1 ? settings.hold : settings.step}s` }}
                            />
                          )}
                        </Hit>
                      );
                    })}
                  </g>
                )}
                {(lenses.length > 1 || centre.slots.length > 1) &&
                  ([-1, 1] as const).map((by) => (
                    <Hit
                      key={by}
                      label={by > 0 ? '下一個時間點' : '上一個時間點'}
                      onHit={() => skip.current.step(by)}
                      className={styles.arrow}
                      box={{
                        x: by * centre.arrows.x - centre.arrows.size * 0.8,
                        y: centre.arrows.y - centre.arrows.size * 0.9,
                        width: centre.arrows.size * 1.6,
                        height: centre.arrows.size * 1.8,
                      }}
                    >
                      <text
                        x={by * centre.arrows.x}
                        y={centre.arrows.y + centre.arrows.size * 0.36}
                        fontSize={centre.arrows.size}
                        textAnchor="middle"
                      >
                        {by > 0 ? '›' : '‹'}
                      </text>
                    </Hit>
                  ))}
              </g>
            )}
            {playing?.lens.scene === 'compare' && band && spectrum && (
              // The spectrum's axis at the foot: green to blue through the ink, as the words are coloured.
              <g key={`axis-${playing.run}`} className={styles.fadeIn}>
                <defs>
                  <linearGradient id="camp-axis" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor={spectrum.green} />
                    <stop offset="0.5" stopColor={spectrum.ink} />
                    <stop offset="1" stopColor={spectrum.blue} />
                  </linearGradient>
                </defs>
                {(() => {
                  const pad = band.width * 0.07;
                  const y = band.y + band.height + band.axis * 0.3;
                  const size = canvas.title * 0.36;
                  return (
                    <>
                      <rect
                        x={pad}
                        y={y}
                        width={band.width - 2 * pad}
                        height={Math.max(2, size * 0.18)}
                        rx={size * 0.09}
                        fill="url(#camp-axis)"
                      />
                      <text x={pad} y={y + size * 1.35} fontSize={size} fontWeight={700} fill={spectrum.green}>
                        ← 綠營媒體提得多
                      </text>
                      <text x={band.width / 2} y={y + size * 1.35} fontSize={size} textAnchor="middle" className={styles.note}>
                        兩邊差不多
                      </text>
                      <text x={band.width - pad} y={y + size * 1.35} fontSize={size} fontWeight={700} textAnchor="end" fill={spectrum.blue}>
                        藍營媒體提得多 →
                      </text>
                    </>
                  );
                })()}
              </g>
            )}
            <g className={styles.fadeIn}>
              {words.map((w, i) => (
                <Word key={w.key} word={w} picture={pictures[w.label]} colour={colourOf(w)} index={i} />
              ))}
            </g>
          </svg>
        )}
      </div>
    </main>
  );
}
const NO_PICTURES: Pictures = {};

/** A tappable part of the centre (a time point, a ‹ ›): a clear box over it takes the tap, and Enter or Space works too. */
function Hit({
  label,
  onHit,
  box,
  className,
  opacity,
  children,
}: {
  label: string;
  onHit: () => void;
  box: { x: number; y: number; width: number; height: number };
  className?: string;
  opacity?: number;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG has no <button>; this is one in role and keys.
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      className={`${styles.hit} ${className ?? ''}`}
      opacity={opacity}
      onClick={onHit}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onHit();
      }}
    >
      <rect {...box} fill="transparent" />
      {children}
    </g>
  );
}

function Word({ word, picture, colour, index }: { word: Shown; picture?: Pictures[string]; colour?: string; index: number }) {
  const k = word.fontSize / BASE;
  const image = picture?.image || picture?.emoji;
  // Text sits at its box's left edge, a picture at its centre, so both scale in place.
  const x = image ? word.x + word.width / 2 : word.x + 2;
  const small = word.phase !== 'live';
  // Text grows from its middle rather than its corner when it enters or leaves.
  const cx = image ? 0 : (word.width - 4) / 2;
  const cy = image ? word.height / 2 : (word.fontSize * 1.6) / 2;
  const s = small && !word.fade ? 0.3 : 1;
  const style = {
    transform: `translate(${x + cx * (1 - s)}px, ${word.y + cy * (1 - s)}px) scale(${k * s})`,
    opacity: small ? 0 : 1,
    // A change of lens: the old words fade out over 1.2 s and the new ones start fading in before they are gone, a little apart.
    ...(word.fade
      ? {
          transitionProperty: 'opacity',
          transitionDuration: word.phase === 'enter' ? '1s' : '1.2s',
          transitionTimingFunction: 'ease',
          transitionDelay: word.phase === 'enter' ? `${enterDelay(true, index)}s` : '0s',
        }
      : // Moves first; newcomers grow in once the leavers have mostly gone, a little apart.
        { transitionDelay: word.phase === 'enter' ? `${enterDelay(false, index)}s` : '0s' }),
  };
  const href = `/tag/${encodeURIComponent(word.label)}/`;
  // Text leaves the room it was given for the badge free.
  const textWidth = (word.width - 4 - (image ? 0 : (word.extra ?? 0) * word.fontSize)) / k;
  // The word (or a picture's name under it) and its change badge, centred together: a word in the
  // room it was given, a name under its picture. The pair slides as the badge's width changes.
  const box = image ? pictureBox(word.label, BASE, picture?.aspect) : null;
  // A picture's name keeps at least ~9 units on screen however small the face is drawn.
  const caption = box ? Math.max(box.caption, 9 / k) : 0;
  // The badge is a small pill (tinted for up and new, grey for down) so it never reads as part of the word.
  const size = box ? Math.max(caption * 0.68, 7 / k) : Math.max(BASE * 0.26, 8 / k);
  const gap = box ? caption * 0.3 : BASE * 0.14;
  const pad = size * 0.4;
  const textSize = word.badge?.small ? size * 0.8 : size;
  const badgeText = word.badge ? ems(word.badge.text) * textSize : 0;
  const badgeWidth = word.badge ? gap + badgeText + 2 * pad : 0;
  const shift = box ? -badgeWidth / 2 : Math.max(0, ((word.extra ?? 0) * BASE - badgeWidth) / 2);
  const label = box ? (
    <text y={box.pictureHeight + caption * 1.05} fontSize={caption} textAnchor="middle" fill="currentColor">
      {word.label}
    </text>
  ) : (
    <text y={BASE * 1.25} fontSize={BASE} textLength={textWidth} lengthAdjust="spacingAndGlyphs" fill={colour ?? 'currentColor'}>
      {word.label}
    </text>
  );
  const mark = word.badge && (
    <BadgePill
      text={word.badge.text}
      up={word.badge.up}
      colour={colour}
      x={(box ? (ems(word.label) * caption) / 2 : textWidth) + gap}
      // Level with the middle of the word, or of the picture's name.
      middle={box ? box.pictureHeight + caption * 0.65 : BASE * 0.8}
      size={size}
      textSize={textSize}
      width={badgeText + 2 * pad}
      shown={word.phase === 'live'}
    />
  );

  return (
    <Link prefetch={false} href={href} aria-label={word.label} className={styles.link} tabIndex={word.phase === 'exit' ? -1 : undefined}>
      <g className={styles.word} style={style}>
        <rect x={image ? -word.width / 2 / k : -2 / k} width={word.width / k} height={word.height / k} fill="transparent" />
        {box && <Picture box={box} picture={picture} />}
        <g className={styles.shift} style={{ transform: `translate(${shift}px, 0px)` }}>
          {label}
          {mark}
        </g>
      </g>
    </Link>
  );
}

function BadgePill({
  text,
  up,
  colour,
  x,
  middle,
  size,
  textSize,
  width,
  shown,
}: {
  text: string;
  up: boolean;
  colour?: string;
  x: number;
  middle: number;
  size: number;
  /** The label's type size; the pill keeps the height `size` gives every badge. */
  textSize: number;
  width: number;
  shown: boolean;
}) {
  const height = size * 1.45;
  return (
    <g className={`${styles.badge} ${up ? '' : styles.down}`} opacity={shown ? 1 : 0}>
      <rect x={x} y={middle - height / 2} width={width} height={height} rx={height / 2} fill={up ? colour : undefined} fillOpacity={0.14} />
      <text x={x + width / 2} y={middle + textSize * 0.36} fontSize={textSize} textAnchor="middle" fill={up ? colour : undefined}>
        {text}
      </text>
    </g>
  );
}

/**
 * A tag's picture (its name is drawn by Word): a person's sketch as on its page
 * (components/TagPerson.tsx), already painted (?layer=color: orange strokes on
 * the white person), so it reads the same on light and dark pages; or another
 * tag's place or logo (already orange) or emoji.
 */
function Picture({ box, picture }: { box: ReturnType<typeof pictureBox>; picture?: Pictures[string] }) {
  return picture?.image ? (
    <image
      href={`${picture.image}${picture.image.includes('?') ? '&' : '?'}layer=color`}
      x={-box.pictureWidth / 2}
      width={box.pictureWidth}
      height={box.pictureHeight}
    />
  ) : (
    <text y={box.side * 0.82} fontSize={box.side * 0.82} textAnchor="middle">
      {picture?.emoji}
    </text>
  );
}
